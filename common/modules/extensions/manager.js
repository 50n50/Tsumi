import { settings } from '@/modules/settings.js'
import { cache, caches } from '@/modules/cache.js'
import { getRandomInt } from '@/modules/util.js'
import { status, printError } from '@/modules/networking.js'
import { SUPPORTS } from '@/modules/support.js'
import { toast } from 'svelte-sonner'
import { wrap } from 'comlink'
import Debug from 'debug'
const debug = Debug('ui:manager')

/**
 * Creates and returns a new Web Worker instance for the given extension source.
 * @param {object} source The extension source object.
 * @returns {Worker} The created worker instance.
 */
function createWorker(source) {
  return new Worker(new URL('@/modules/extensions/worker.js', import.meta.url), { type: 'module', name: (source.locale || (source.update + '/')) + source.id })
}

/**
 * Fetches and validates an extension manifest from a given URL.
 * Supports 'gh:', 'npm:', 'file:', 'extension:', and 'http(s)' protocols.
 * @param {string} url The manifest URL or file path.
 * @param {boolean} updateCheck If the reason for getting the manifest is to check for updates.
 * @returns {Promise<object[]|null>} A parsed manifest array or null on error.
 */
async function getManifest(url, updateCheck = false) {
  try {
    if (url.startsWith('http')) return await (await fetch(url)).json()
    if (/^[A-Z]:/.test(url) || url.startsWith('file:') || url.startsWith('extension:')) {
      const localeURL = (url.startsWith('extension:') ? url.replace(/^extension:/, 'file:') : url.startsWith('file:') ? url.replace(/^file:(?!\/{3})/, 'file:///') : `file:///${url.replace(/\\/g, '/')}`).replace(/^file:\/+/, 'file:///')
      const manifest = await (await fetch(localeURL + (!/\.json(\?|$)/i.test(localeURL) ? `${localeURL.endsWith('/') ? '' : '/'}index.json` : ''))).json()
      const basePath = url.replace(/^extension:/, '').replace(/^file:(?!\/{3})/, '').replace(/^file:\/+/, '').replace(/\\/g, '/').replace(/^[\/]+/, '').replace(/[^/]+\.json$/, '')
      for (const source of manifest) {
        if (source?.id) source.locale = `extension://${basePath}${basePath.endsWith('/') ? '' : '/'}`
      }
      return manifest
    }
    const { pathname, protocol } = new URL(url)
    if (protocol !== 'gh:' && protocol !== 'npm:') throw new Error(`Unknown protocol for source, expected: 'gh:', 'npm:', 'file:', 'extension:', or 'http(s)'`)
    const basePath = `https://esm.sh${protocol === 'gh:' ? '/gh' : ''}/${pathname}`
    const response = await fetch(/\.json(\?|$)/i.test(basePath) ? basePath : `${basePath}/index.json`)
    if (!response.ok) throw new Error(`Unable to load manifest due to a connection issue ${response.status} ${response.statusText}`)
    const manifest = await response.json()
    if (!Array.isArray(manifest)) throw new Error('Manifest is not an array')
    return manifest
  } catch (error) {
    if (!updateCheck || !(error?.status === 429 || error?.status === 503)) await printError('Failed to fetch Source', `Unable to load manifest for: ${url}`, error)
    return null
  }
}

/**
 * Fetches the JavaScript code for a given extension from the provided URL.
 * @param {string} name The extension name or ID.
 * @param {string} url The source URL.
 * @returns {Promise<string|null>} The fetched extension code or null on failure.
 */
async function getExtension(name, url) {
  try {
    if (url.startsWith('http')) return await (await fetch(url)).json()
    if (url.startsWith('extension:')) return `${url}.js`
    const parsedUrl = new URL(url)
    const ghProtocol = parsedUrl.protocol === 'gh:'
    if (ghProtocol || parsedUrl.protocol === 'npm:') {
      const pathParts = parsedUrl.pathname.split('/')
      try {
        const response = await fetch(`${ghProtocol ? `https://esm.sh/gh/${pathParts[0]}/${pathParts[1]}` : `https://esm.sh/${pathParts[0]}`}/es2022/${pathParts.slice(ghProtocol ? 2 : 1).join('/')}.mjs`)
        if (!response.ok) throw new Error(`Failed to load extension code for url ${url} ${response.status} ${response.statusText}`)
        const code = await response.text()
        if (!code || code.trim().length === 0) throw new Error(`Failed to load extension code for url ${url}, extension code is empty`)
        return code
      } catch (error) {
        await printError(`Failed to load extension ${name}`, error.message, error)
        return null
      }
    }
    throw new Error(`Unknown protocol for extension, expected: 'gh:', 'npm:', 'file:', 'extension:', or 'http(s)'`)
  } catch (error) {
    await printError('Failed to fetch Extension', `Unable to load extension for: ${name} ${url}`, error)
    return null
  }
}

/** Manages loading, caching, and lifecycle of extensions and their workers. */
class ExtensionManager {
  /** @type {Map<string, Promise<any>>} */
  pending = new Map()
  /** @type {Record<string, import('comlink').Remote<import('@/modules/extensions/worker.js').Worker>>} */
  activeWorkers = {}
  /** @type {Record<string, import('comlink').Remote<import('@/modules/extensions/worker.js').Worker>>} */
  inactiveWorkers = {}
  /** @type {Promise<void|boolean>} */
  whenReady = Promise.resolve(false)

  constructor() {
    let sources = null
    debug('Loading extensions from sources...')
    settings.subscribe(value => {
      const newSources = value.sourcesNew || {}
      const sourcesOld = Object.keys(sources || {})
      const sourcesNew = Object.keys(newSources)
      if ((!sourcesOld?.length && !sourcesNew?.length) || !(sourcesOld.length === sourcesNew.length && sourcesOld.every(key => sourcesNew.includes(key)))) {
        if (sourcesOld.length && !sourcesNew.length) { sources = structuredClone(newSources); return }
        if (!sources && !sourcesNew.length) sources = {}
        else if (sourcesNew.length) {
          sources = structuredClone(newSources)
          this.whenReady = this.updateExtensions(newSources, value.extensionSources).then(update => this.loadExtensions(newSources, update)).catch(error => {
            printError('Failed to Update Extensions', `Unable to check for updates or update extensions.`, error)
            return this.loadExtensions(value.sourcesNew, false)
          })
          debug('Found new sources and updated...', JSON.stringify(newSources))
        }
      }
    })

    window.addEventListener('online', async () => {
      for (const [key, worker] of Object.entries(extensionManager.inactiveWorkers)) {
        if (!this.activeWorkers[key]) {
          try {
            if (!(await worker.validate())) throw new Error(`Source #validate() failed`)
            this.activeWorkers[key] = worker
            delete this.inactiveWorkers[key]
          } catch (error) {
            if (!this.inactiveWorkers[key]) worker.terminate()
            await printError(`Failed to load extension ${key}`, error.message, error)
          }
        }
      }
    })
  }

  /** Terminates all workers and reloads extensions from settings. */
  reloadExtensions() {
    Object.values(this.activeWorkers).forEach(worker => worker.terminate())
    Object.values(this.inactiveWorkers).forEach(worker => worker.terminate())
    this.activeWorkers = {}
    this.whenReady = this.loadExtensions(settings.value.sourcesNew)
  }

  /**
   * Removes a specific extension source and clears related cache entries.
   * @param {string} extensionId The extension identifier.
   */
  async removeSource(extensionId) {
    settings.update((value) => {
      const sourcesNew = { ...value.sourcesNew }
      const extensionsNew = { ...value.extensionsNew }
      for (const [_key, source] of Object.entries(sourcesNew)) {
        if (source.update === extensionId) {
          const key = (source.locale || (source.update + '/')) + source.id
          if (this.activeWorkers[key]) {
            this.activeWorkers[key].terminate()
            delete this.activeWorkers[key]
          } else if (this.inactiveWorkers[key]) {
            this.inactiveWorkers[key].terminate()
            delete this.inactiveWorkers[key]
          }
          delete sourcesNew[_key]
          delete extensionsNew[_key]
          cache.deleteEntry(caches.EXTENSIONS, _key).catch(error => debug('Failed to delete cache entry for removed source:', error))
        }
      }
      return { ...value, sourcesNew, extensionsNew }
    })
  }

  /**
   * Adds a new extension source and validates its manifest.
   * @param {string} url The source URL.
   * @param {boolean} [trusted=false] Whether this source is trusted.
   * @returns {Promise<string|void>} A status message or undefined.
   */
  async addSource(url, trusted = false) {
    if (this.pending.has(url)) return this.pending.get(url)
    const promise = (async () => {
      const config = await getManifest(url)
      if (!config) {
        await printError('Failed to load source', `${url}: ${status.value !== 'offline' ? 'the source is not valid.' : 'no network connection!'}`, { message: `Failed to load source: ${url} ${status.value !== 'offline' ? 'the source is not valid.' : 'no network connection!'} ${JSON.stringify(config)}`})
        this.pending.delete(url)
        return `Failed to load extension(s) from the provided source '${url}': ${status.value !== 'offline' ? 'the source is not valid.' : 'no network connection!'}`
      }
      if (config.every(entry => entry?.main && !entry?.update)) { // source repository manifests
        const current = settings.value.extensionSources?.[url]
        if (JSON.stringify(current) !== JSON.stringify(config)) {
          settings.update(value => ({ ...value, extensionSources: { ...(value.extensionSources || {}), [url]: config } }))
          debug(`Stored new source repository: ${url}`)
        } else {
          debug(`Source repository unchanged: ${url}`)
          this.pending.delete(url)
          return `Source repository unchanged: ${url}`
        }
      } else { // extension manifests
        for (const extension of config) {
          if (!this.validateConfig(extension)) {
            await printError('Invalid extension format', `Invalid extension config: ${url}`, {message: `Invalid extension config: ${url} ${JSON.stringify(extension)}`})
            this.pending.delete(url)
            return `Failed to load extension(s) from '${url}': invalid extension format.`
          }
        }
        settings.update(value => {
          const sourcesNew = {...value.sourcesNew}
          const extensionsNew = {...value.extensionsNew}
          config.forEach(extension => {
            const key = (extension.locale || (extension.update + '/')) + extension.id
            sourcesNew[key] = {...extension, trusted}
            if (!extensionsNew[key]) extensionsNew[key] = {enabled: true}
          })
          return {...value, sourcesNew, extensionsNew}
        })
      }
      this.pending.delete(url)
    })()
    this.pending.set(url, promise)
    return promise
  }

  /**
   * Loads extension modules from cache or network and starts workers.
   * @param {object} extensions Extension metadata.
   * @param {boolean} update Whether this load is an update pass.
   * @returns {Promise<boolean>} True if successful, false otherwise.
   */
  async loadExtensions(extensions, update) {
    const extensionIds = Object.keys(extensions || {})
    if (!extensionIds?.length) return false

    const modules = !update ? Object.fromEntries(await Promise.all(extensionIds.map(async (id) => {
      try {
        const cachedModule = await cache.cachedEntry(caches.EXTENSIONS, (extensions[id]?.locale || (extensions[id]?.update + '/')) + extensions[id]?.id, true)
        if (!cachedModule || (typeof cachedModule === 'string' && cachedModule.trim().length === 0)) {
          debug(`Cached module for ${id} is invalid, will refetch`)
          return null
        }
        return [id, cachedModule]
      } catch (error) {
        debug(`Error reading cache for ${id}:`, error)
        return null
      }
    })).then(results => results.flatMap(result => result ? [result] : []))) : {}

    for (const key of extensionIds) {
      if (!modules[key]) {
        const newCode = await getExtension(extensions[key]?.name || extensions[key]?.id, (extensions[key]?.locale || (extensions[key]?.update + '/')) + extensions[key]?.main)
        if (newCode && typeof newCode === 'string' && newCode.trim().length > 0) {
          if (!extensions[key].locale) {
            modules[key] = await cache.cacheEntry(caches.EXTENSIONS, key, { mappings: true }, newCode, Date.now() + getRandomInt(7, 14) * 24 * 60 * 60 * 1_000)
            if (!modules[key]) {
              debug(`Cache write failed for ${key}, using code directly`)
              modules[key] = newCode
            }
          } else modules[key] = newCode
        } else {
          debug(`Failed to fetch extension ${key}, attempting to use cached version`)
          modules[key] = await cache.cachedEntry(caches.EXTENSIONS, key, true)
          if (!modules[key] || (typeof modules[key] === 'string' && modules[key].trim().length === 0)) {
            debug(`No valid cache fallback for ${key}, skipping extension`)
            await cache.deleteEntry(caches.EXTENSIONS, key).catch(error => debug('Failed to delete empty cache entry:', error))
            continue
          }
        }
        if (!modules[key]) {
          debug(`No valid module code for ${key}, skipping`)
          continue
        }
      }

      if (!this.activeWorkers[key]) {
        try {
          if (this.inactiveWorkers[key]) {
            this.inactiveWorkers[key].terminate()
            delete this.inactiveWorkers[key]
          }
          const worker = createWorker(extensions[key])
          if (SUPPORTS.isAndroid && extensions[key].trusted) worker.onmessage = async (event) => this.portMessage(event, worker) // hacky Android workaround for Access-Control-Allow-Origin error.
          try {
            /** @type {comlink.Remote<import('@/modules/extensions/worker.js').Worker>} */
            const remoteWorker = await wrap(worker)
            const initialize = await remoteWorker.initialize(key, modules[key], { bypassCORS: SUPPORTS.isAndroid && extensions[key].trusted})
            if (!initialize.validated) {
              this.inactiveWorkers[key] = remoteWorker
              throw new Error(initialize.error)
            }
            this.activeWorkers[key] = remoteWorker
          } catch (error) {
            if (!this.inactiveWorkers[key]) worker.terminate()
            throw new Error(error)
          }
        } catch (error) {
          await printError(`Failed to load extension ${key}`, error.message, error)
        }
      }
    }
    return true
  }

  /**
   * Updates the extension source repository if it has changed.
   *
   * @param {string} url - The URL of the source repository.
   * @returns {Promise<boolean>} True if updated, false if unchanged or failed.
   */
  async updateSources(url) {
    try {
      const repositoryManifest = await getManifest(url, true)
      if (!repositoryManifest || !Array.isArray(repositoryManifest) || !repositoryManifest.every(entry => entry?.main && !entry?.update)) return false
      if (JSON.stringify(settings.value.extensionSources?.[url]) !== JSON.stringify(repositoryManifest)) {
        settings.update(value => ({ ...value,  extensionSources: { ...(value.extensionSources || {}), [url]: repositoryManifest } }))
        debug(`Source repository updated: ${url}`)
        return true
      }
      debug(`Source repository unchanged: ${url}`)
      return false
    } catch (error) {
      await printError('Failed to update Source Repository', `Unable to update repository for: ${url}`, error)
      return false
    }
  }

  /**
   * Checks for newer versions of existing extensions and updates them.
   * @param {object} currentExtensions Currently installed extensions.
   * @param {object} extensionSources Currently added extension source repositories.
   * @returns {Promise<boolean>} True if updates were found, false otherwise.
   */
  async updateExtensions(currentExtensions, extensionSources) {
    const extensionIds = Object.keys(currentExtensions || {})
    if (!extensionIds?.length) return false
    try {
      const latestManifests = await Promise.all(Object.values(currentExtensions || {}).map(ext => ext?.locale || ext?.update).filter(url => url).map(url => getManifest(url, true)))
      const validManifests = latestManifests.filter(manifest => manifest !== null && Array.isArray(manifest))
      if (validManifests.length === 0) {
        debug('No valid manifests retrieved during update check, skipping update')
        return false
      }
      const latestValid = Object.fromEntries(validManifests.flat().filter(config => this.validateConfig(config) && extensionIds.includes((config.locale || (config.update + '/')) + config.id)).map(config => [((config.locale || (config.update + '/')) + config.id), config]))
      const toUpdate = extensionIds.filter(id => Object.keys(latestValid).length && currentExtensions && latestValid[id] && latestValid[id]?.version !== currentExtensions[id]?.version)
      if (toUpdate.length) {
        debug(`Found ${toUpdate.length} extensions to update:`, toUpdate)
        settings.update((value) => {
          const sourcesNew = { ...value.sourcesNew }
          toUpdate.forEach(id => {
            try {
              if (this.activeWorkers[id] && latestValid[id]) {
                this.activeWorkers[id].terminate()
                delete this.activeWorkers[id]
              }
            } catch (error) {
              debug('Failed to terminate active workers during update, how did we even get here...?')
            }
            if (latestValid[id]) sourcesNew[id] = { ...latestValid[id], trusted: sourcesNew[id].trusted }
          })
          return { ...value, sourcesNew }
        })
        debug(`Successfully updated ${toUpdate.length} extension${toUpdate.length > 1 ? 's' : ''}`, toUpdate)
        toast.success(`Updated ${toUpdate.length} extension${toUpdate.length > 1 ? 's' : ''}`, {
          description: `${toUpdate.map(id => currentExtensions[id]?.name || id).join(', ')}`,
          duration: 8_000
        })
        return true
      }
      const sourceUrls = Object.keys(extensionSources || {})
      if (sourceUrls.length) {
        debug(`Checking ${sourceUrls.length} stored source repositories for updates...`)
        await Promise.all(sourceUrls.map(url => this.updateSources(url)))
      }
      return toUpdate.length > 0
    } catch (error) {
      await printError('Extension update check failed', 'The previously cached version will be used if available', error)
      return false
    }
  }

  /**
   * Handles proxied network requests from workers (Android CORS workaround).
   * @param {MessageEvent} event Message from the worker.
   * @param {Worker} worker The worker sending the request.
   */
  async portMessage(event, worker) {
    const { type, requestId, url, options } = event.data || {}
    if (type === 'FETCH') {
      try {
        const response = await fetch(url, options)
        const text = await response.text()
        let json
        try { json = JSON.parse(text) } catch { json = {} }
        worker.postMessage({ type: 'RESULT', requestId, ok: response.ok, status: response.status, text, json })
      } catch (error) {
        worker.postMessage({ type: 'RESULT', requestId, error: error.message || 'unknown error' })
      }
    }
  }

  /**
   * Validates that an extension configuration object has the required fields.
   * @param {object} config The extension config object.
   * @returns {boolean} True if valid, false otherwise.
   */
  validateConfig(config) {
    return config && typeof config === 'object' && ['id', 'name', 'version', 'main', 'update'].every(prop => prop in config)
  }
}

/** @type {ExtensionManager} Global extension manager instance. */
export const extensionManager = new ExtensionManager()