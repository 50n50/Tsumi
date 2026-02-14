import { writable } from 'simple-store-svelte'
import { settings } from '@/modules/settings.js'
import { ELECTRON } from '@/modules/bridge.js'
import Debug from 'debug'

const debug = Debug('ui:extension:manager')

let cachedProxyPort = null
async function getProxyPort() {
  if (cachedProxyPort !== null) return cachedProxyPort
  try {
    cachedProxyPort = await ELECTRON.getProxyPort?.()
    return cachedProxyPort
  } catch {
    return null
  }
}

export async function extensionFetch(url, options = {}) {
  const headers = options.headers || {}
  const method = (options.method || 'GET').toUpperCase()
  const body = options.body || null

  try {
    const fetchOptions = { headers, method }
    if (body != null && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }
    const response = await fetch(url, fetchOptions)
    return response
  } catch (error) {
    debug('fetch failed:', error)
    return null
  }
}

async function getExtension(url, isJson = false) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`)
  return isJson ? await response.json() : await response.text()
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

function buildFetchv2Polyfill(proxyPort) {
  const normAndWrap = `
function __normArgs(url, headers, method, body) {
  let h = headers || {};
  let m = method;
  let b = body;
  // Handle options-object style: fetchv2(url, { headers, method, body })
  if (h.headers && typeof h.headers === 'object') {
    m = m || h.method;
    b = b !== undefined ? b : h.body;
    h = h.headers;
  }
  return { url, headers: h, method: (m || 'GET').toUpperCase(), body: b };
}
function __wrapResponse(response) {
  const plain = {};
  response.headers.forEach(function(v, k) { plain[k] = v; });
  if (plain['x-set-cookie']) {
    try {
      var cookies = JSON.parse(plain['x-set-cookie']);
      var val = Array.isArray(cookies) ? cookies.join(', ') : cookies;
      plain['set-cookie'] = val;
      plain['Set-Cookie'] = val;
    } catch(_) {
      plain['set-cookie'] = plain['x-set-cookie'];
      plain['Set-Cookie'] = plain['x-set-cookie'];
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: plain,
    text: function() { return response.text(); },
    json: function() { return response.json(); },
    arrayBuffer: function() { return response.arrayBuffer(); },
    blob: function() { return response.blob(); }
  };
}
`

  if (!proxyPort) {
    // Fallback: direct fetch (User-Agent and other forbidden headers won't work)
    return `
${normAndWrap}
async function fetchv2(url, headers, method, body) {
  var args = __normArgs(url, headers, method, body);
  var options = {
    method: args.method,
    headers: args.headers
  };
  if (args.body != null && args.method !== 'GET' && args.method !== 'HEAD') {
    options.body = typeof args.body === 'string' ? args.body : JSON.stringify(args.body);
  }
  var response = await fetch(args.url, options);
  return __wrapResponse(response);
}
`
  }

  // Route through the Node.js proxy so all headers (User-Agent, Cookie, Referer) work
  return `
${normAndWrap}
async function fetchv2(url, headers, method, body) {
  var args = __normArgs(url, headers, method, body);
  var proxyBody = {
    url: args.url,
    headers: args.headers,
    method: args.method
  };
  if (args.body != null) {
    proxyBody.body = args.body;
  }
  var response = await fetch('http://localhost:${proxyPort}/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proxyBody)
  });
  return __wrapResponse(response);
}
`
}

export async function executeExtensionFunction(scriptCode, functionName, ...args) {
  const proxyPort = await getProxyPort()
  const fetchv2Polyfill = buildFetchv2Polyfill(proxyPort)

  const code = `
    ${fetchv2Polyfill}
    ${scriptCode}
    return await ${functionName}(${args.map(a => JSON.stringify(a)).join(', ')})
  `

  const fn = new AsyncFunction(code)

  const timeout = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      reject(new Error('Extension execution timeout'))
    }, 30000)
  })

  return Promise.race([fn(), timeout])
}

export async function loadExtension(manifestUrl) {
  const resolvedManifestUrl = new URL(manifestUrl, window.location.href).href

  let manifest
  try {
    manifest = await getExtension(resolvedManifestUrl, true)
  } catch (error) {
    throw new Error(`Failed to load manifest from ${resolvedManifestUrl}: ${error.message}`)
  }

  if (!manifest.sourceName || !manifest.scriptUrl) {
    throw new Error('Invalid manifest: missing sourceName or scriptUrl')
  }

  const resolvedScriptUrl = new URL(manifest.scriptUrl, resolvedManifestUrl).href

  let script
  try {
    script = await getExtension(resolvedScriptUrl, false)
  } catch (error) {
    throw new Error(`Failed to load script from ${resolvedScriptUrl}: ${error.message}`)
  }

  return { manifest, script }
}

export async function callExtensionFunction(extension, functionName, ...args) {
  if (!extension?.script) {
    throw new Error('Extension not loaded')
  }

  try {
    const result = await executeExtensionFunction(
      extension.script,
      functionName,
      ...args
    )

    if (typeof result === 'string') {
      try {
        return JSON.parse(result)
      } catch {
        return result
      }
    }

    return result
  } catch (error) {
    debug(`Failed to call ${functionName} on extension:`, error)
    throw error
  }
}

class ExtensionManager {
  constructor() {
    this.extensions = new Map()
    this.loading = new Map() 
    this.enabled = writable({})
    this.subscribers = new Set()
    settings.subscribe(value => {
      if (value.extensions) {
        this.syncFromSettings(value.extensions)
      }
    })
  }

  notify() {
    this.subscribers.forEach(cb => cb())
  }

  subscribe(cb) {
    this.subscribers.add(cb)
    cb()
    return () => this.subscribers.delete(cb)
  }

  async addExtension(manifestUrl) {
    try {
      const { manifest, script } = await loadExtension(manifestUrl)
      const key = `${manifest.sourceName}-${manifest.version}`

      this.extensions.set(key, { manifest, script })

      settings.set({
        ...settings.value,
        extensions: {
          ...settings.value.extensions,
          [key]: {
            url: manifestUrl,
            enabled: true,
            manifest
          }
        }
      })

      this.notify()
      return key
    } catch (error) {
      console.error('Failed to add extension:', error)
      throw error
    }
  }

  async removeExtension(key) {
    this.extensions.delete(key)

    const updated = { ...settings.value.extensions }
    delete updated[key]
    settings.set({
      ...settings.value,
      extensions: updated
    })
    this.notify()
  }

  toggleExtension(key, enabled) {
    if (settings.value.extensions?.[key]) {
      settings.set({
        ...settings.value,
        extensions: {
          ...settings.value.extensions,
          [key]: {
            ...settings.value.extensions[key],
            enabled
          }
        }
      })
      this.notify()
    }
  }

  setDefault(key) {
    settings.set({
      ...settings.value,
      defaultExtension: key
    })
    this.notify()
  }

  unsetDefault() {
    settings.set({
      ...settings.value,
      defaultExtension: null
    })
    this.notify()
  }

  setStar(key) {
    settings.set({
      ...settings.value,
      starredExtension: key
    })
    this.notify()
  }

  unsetStar() {
    settings.set({
      ...settings.value,
      starredExtension: null
    })
    this.notify()
  }

  async syncFromSettings(extensionConfigs) {
    for (const [key, config] of Object.entries(extensionConfigs)) {
      if (!this.extensions.has(key) && !this.loading.has(key) && config?.url) {
        this.loading.set(
          key,
          loadExtension(config.url)
            .then(loaded => {
              this.extensions.set(key, loaded)
              this.loading.delete(key)
              this.notify()
            })
            .catch(error => {
              debug(`Failed to sync extension ${key}:`, error)
              this.loading.delete(key)
            })
        )
      }
    }
  }

  getEnabled() {
    const result = []
    for (const [key, ext] of this.extensions) {
      const config = settings.value.extensions?.[key]
      if (config?.enabled) {
        result.push({ key, ...ext })
      }
    }
    return result
  }

  async callDefault(functionName, ...args) {
    const defaultKey = settings.value.defaultExtension
    if (!defaultKey) throw new Error('No default extension set')

    const extension = this.extensions.get(defaultKey)
    if (!extension) throw new Error(`Extension ${defaultKey} not loaded`)

    return callExtensionFunction(extension, functionName, ...args)
  }

  async callAll(functionName, ...args) {
    const enabled = this.getEnabled()
    const results = []

    for (const ext of enabled) {
      try {
        const result = await callExtensionFunction(ext, functionName, ...args)
        results.push({ extension: ext.key, result })
      } catch (error) {
        debug(`Error calling ${functionName} on ${ext.key}:`, error)
      }
    }

    return results
  }
}

export const extensionManager = new ExtensionManager()

export const manager = {
  subscribe: (cb) => extensionManager.subscribe(cb),
  addExtension: (url) => extensionManager.addExtension(url),
  removeExtension: (key) => extensionManager.removeExtension(key),
  toggleExtension: (key, enabled) => extensionManager.toggleExtension(key, enabled),
  setDefault: (key) => extensionManager.setDefault(key),
  unsetDefault: () => extensionManager.unsetDefault(),
  setStar: (key) => extensionManager.setStar(key),
  unsetStar: () => extensionManager.unsetStar(),
  getEnabled: () => extensionManager.getEnabled(),
  callDefault: (...args) => extensionManager.callDefault(...args),
  callAll: (...args) => extensionManager.callAll(...args)
}
