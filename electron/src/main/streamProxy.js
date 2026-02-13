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

      expressApp.get('/proxy', async (req, res) => {
        try {
          const { url, headers } = req.query

          if (!url) {
            return res.status(400).json({ error: 'Missing url parameter' })
          }

          const decodedUrl = decodeURIComponent(url)
          const decodedHeaders = headers ? JSON.parse(decodeURIComponent(headers)) : {}

          const response = await fetch(decodedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              ...decodedHeaders
            }
          })

          if (!response.ok) {
            return res.status(response.status).json({ error: `Stream request failed: ${response.status}` })
          }

          const contentType = response.headers.get('content-type') || 'application/octet-stream'
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          res.setHeader('Access-Control-Allow-Origin', '*')

          const buffer = await response.arrayBuffer()
          let body = Buffer.from(buffer)

          // Rewrite m3u8 playlists: convert every URL to an absolute proxy URL
          if (decodedUrl.includes('.m3u8') || contentType.includes('mpegurl')) {
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
          }

          res.setHeader('Content-Length', body.length)
          res.send(body)
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
