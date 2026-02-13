import express from 'express'
import { app } from 'electron'
import Debug from 'debug'

const debug = Debug('electron:streaming-proxy')

let server = null
let expressApp = null

export async function startStreamProxy() {
  if (server) return server.address().port

  return new Promise((resolve, reject) => {
    try {
      expressApp = express()
      expressApp.use(express.json({ limit: '10mb' }))

      // General-purpose fetch proxy — supports all HTTP methods and custom headers
      // (including User-Agent, Cookie, Referer which are forbidden in browser fetch)
      expressApp.post('/fetch', async (req, res) => {
        try {
          const { url, headers: reqHeaders, method, body: reqBody } = req.body

          if (!url) {
            return res.status(400).json({ error: 'Missing url' })
          }

          const fetchOptions = {
            method: (method || 'GET').toUpperCase(),
            headers: reqHeaders || {}
          }

          if (reqBody != null && fetchOptions.method !== 'GET' && fetchOptions.method !== 'HEAD') {
            fetchOptions.body = typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody)
          }

          const response = await fetch(url, fetchOptions)

          const contentType = response.headers.get('content-type') || 'application/octet-stream'
          res.setHeader('Content-Type', contentType)
          res.setHeader('Access-Control-Allow-Origin', '*')

          // Forward Set-Cookie so extensions can read cookies from responses
          const setCookie = response.headers.getSetCookie?.() || []
          if (setCookie.length) {
            res.setHeader('X-Set-Cookie', JSON.stringify(setCookie))
          }

          res.status(response.status)
          const buffer = await response.arrayBuffer()
          res.send(Buffer.from(buffer))
        } catch (error) {
          debug('Fetch proxy error:', error)
          if (!res.headersSent) {
            res.status(500).json({ error: error.message })
          }
        }
      })

      expressApp.get('/proxy', async (req, res) => {
        try {
          const { url, headers } = req.query

          if (!url) {
            return res.status(400).json({ error: 'Missing url parameter' })
          }

          const decodedUrl = decodeURIComponent(url)
          const decodedHeaders = headers ? JSON.parse(decodeURIComponent(headers)) : {}

          const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...decodedHeaders
          }

          // Forward Range header for video seeking support
          if (req.headers.range) {
            fetchHeaders.Range = req.headers.range
          }

          const response = await fetch(decodedUrl, { headers: fetchHeaders })

          if (!response.ok && response.status !== 206) {
            return res.status(response.status).json({ error: `Stream request failed: ${response.status}` })
          }

          const contentType = response.headers.get('content-type') || 'application/octet-stream'
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          res.setHeader('Access-Control-Allow-Origin', '*')

          const isM3U8 = decodedUrl.includes('.m3u8') || contentType.includes('mpegurl')

          if (isM3U8) {
            // Buffer m3u8 playlists to rewrite URLs
            const buffer = await response.arrayBuffer()
            let body = Buffer.from(buffer)
            const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1)
            const port = server.address().port
            const hdrs = encodeURIComponent(JSON.stringify(decodedHeaders))
            const lines = body.toString('utf-8').split(/\r?\n/)
            const rewritten = lines.map(line => {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith('#')) return line
              const absolute = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed
              return `http://localhost:${port}/proxy?url=${encodeURIComponent(absolute)}&headers=${hdrs}`
            }).join('\n')
            body = Buffer.from(rewritten, 'utf-8')
            res.setHeader('Content-Length', body.length)
            res.send(body)
          } else {
            // Stream non-m3u8 responses (MP4, TS segments, etc.)
            res.status(response.status)

            // Forward relevant headers for Range/partial content support
            const contentLength = response.headers.get('content-length')
            const contentRange = response.headers.get('content-range')
            const acceptRanges = response.headers.get('accept-ranges')
            if (contentLength) res.setHeader('Content-Length', contentLength)
            if (contentRange) res.setHeader('Content-Range', contentRange)
            if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges)

            const { Readable } = require('stream')
            const nodeStream = Readable.fromWeb(response.body)
            nodeStream.pipe(res)
            nodeStream.on('error', (err) => {
              debug('Stream pipe error:', err)
              if (!res.headersSent) res.status(500).end()
              else res.end()
            })
          }
        } catch (error) {
          debug('Proxy error:', error)
          if (!res.headersSent) {
            res.status(500).json({ error: error.message })
          }
        }
      })

      expressApp.get('/health', (req, res) => {
        res.json({ status: 'ok' })
      })

      server = expressApp.listen(0, 'localhost', () => {
        const port = server.address().port
        debug(`Proxy server listening on port ${port}`)
        resolve(port)
      })

      server.on('error', reject)
    } catch (error) {
      debug('Failed to start proxy:', error)
      reject(error)
    }
  })
}

export async function stopStreamProxy() {
  if (!server) return

  return new Promise((resolve) => {
    server.close(() => {
      debug('Proxy server stopped')
      server = null
      expressApp = null
      resolve()
    })
  })
}

export function getProxyUrl(streamUrl, headers = {}, proxyPort) {
  if (!proxyPort) return streamUrl

  const encodedUrl = encodeURIComponent(streamUrl)
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers))

  return `http://localhost:${proxyPort}/proxy?url=${encodedUrl}&headers=${encodedHeaders}`
}

app.on('before-quit', async () => {
  await stopStreamProxy()
})
