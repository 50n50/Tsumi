import { ELECTRON } from '@/modules/bridge.js'
import Debug from 'debug'

const debug = Debug('ui:streaming')

let hlsLibrary
let proxyPort = null

function getProxyUrl(streamUrl, headers = {}, proxyPort) {
  if (!proxyPort) return streamUrl
  const encodedUrl = encodeURIComponent(streamUrl)
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers))
  return `http://localhost:${proxyPort}/proxy?url=${encodedUrl}&headers=${encodedHeaders}`
}

async function loadHLSLibrary() {
  if (hlsLibrary !== undefined) return hlsLibrary

  try {
    if (typeof window !== 'undefined' && !window.Hls) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.4.5'
      script.async = true

      await new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    hlsLibrary = window.Hls || null
    return hlsLibrary
  } catch (error) {
    debug('HLS.js unavailable, using native playback:', error)
    hlsLibrary = null
    return null
  }
}

async function getProxyPortInternal() {
  if (proxyPort !== null) return proxyPort

  try {
    proxyPort = await ELECTRON.getProxyPort?.()
    return proxyPort
  } catch (error) {
    debug('Could not get proxy port:', error)
    return null
  }
}

export async function loadStream(video, streamUrl, options = {}) {
  if (!video) throw new Error('No video element provided')
  if (!streamUrl) throw new Error('No stream URL provided')

  const isHLS = streamUrl.toLowerCase().includes('.m3u8')
  const hasHeaders = options.headers && Object.keys(options.headers).length > 0

  if (!isHLS && !hasHeaders) {
    video.src = streamUrl
    return
  }

  if (!isHLS && hasHeaders) {
    const port = await getProxyPortInternal()
    if (port) {
      video.src = getProxyUrl(streamUrl, options.headers, port)
    } else {
      debug('No proxy available, falling back to direct src (headers will be missing)')
      video.src = streamUrl
    }
    return
  }

  const Hls = await loadHLSLibrary()

  const port = hasHeaders ? await getProxyPortInternal() : null

  if (!Hls) {
    debug('HLS.js unavailable, using proxied native playback')
    if (hasHeaders && port) {
      video.src = getProxyUrl(streamUrl, options.headers, port)
    } else {
      video.src = streamUrl
    }
    return
  }

  const hlsConfig = {
    debug: false,
    enableWorker: true,
    lowLatencyMode: !!options.lowLatency,
    testBandwidth: false
  }

  const hlsInstance = new Hls(hlsConfig)
  const sourceUrl = (hasHeaders && port) ? getProxyUrl(streamUrl, options.headers, port) : streamUrl
  debug(`Loading HLS source: ${sourceUrl}`)
  hlsInstance.loadSource(sourceUrl)
  hlsInstance.attachMedia(video)

  return new Promise((resolve, reject) => {
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      debug('Manifest parsed')
      resolve()
    })

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        debug('Fatal error:', data)
        hlsInstance.destroy()
        reject(new Error(`Error: ${data.type}`))
      } else {
        debug('Recoverable error:', data)
      }
    })

    video._hlsInstance = hlsInstance
  })
}

export function stopStream(video) {
  if (!video) return

  if (video._hlsInstance) {
    video._hlsInstance.destroy()
    video._hlsInstance = null
  }

  video.src = ''
}

export function parseStreamResponse(response) {
  if (typeof response === 'string') {
    return {
      url: response,
      headers: {},
      subtitle: null,
      alternatives: []
    }
  }

  if (response?.streams && Array.isArray(response.streams)) {
    const firstStream = response.streams[0]
    return {
      url: firstStream.streamUrl,
      headers: firstStream.headers || {},
      subtitle: response.subtitle || null,
      alternatives: response.streams.slice(1)
    }
  }

  if (response?.streamUrl) {
    return {
      url: response.streamUrl,
      headers: response.headers || {},
      subtitle: response.subtitle || null,
      alternatives: []
    }
  }

  throw new Error('Invalid stream response')
}

export function getStreamServers(response) {
  if (typeof response === 'string') {
    return [{ title: 'Server', streamUrl: response }]
  }

  if (response?.streams && Array.isArray(response.streams)) {
    return response.streams
  }

  if (response?.streamUrl) {
    return [{ title: 'Server', streamUrl: response.streamUrl, headers: response.headers }]
  }

  return []
}

export default parseStreamResponse
