import { app, protocol, shell, ipcMain } from 'electron'
import { development } from './util.js'
import path from 'path'

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('shiru', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('shiru')
}

export default class Protocol {
  // schema: shiru://key/value
  protocolMap = {
    alauth: token => this.sendToken(token),
    malauth: token => this.sendMalToken(token),
    anime: id => this.window.webContents.send('open-anime', { id }),
    malanime: id => this.window.webContents.send('open-anime', { id, mal: true }),
    search: id => this.play(id),
    w2g: link => this.window.webContents.send('w2glink', link),
    schedule: () => this.window.webContents.send('schedule'),
    update: () => ipcMain.emit('quit-and-install'),
    show: () => ipcMain.emit('window-show')
  }

  protocolRx = /shiru:\/\/([a-z0-9]+)\/(.*)/i

  /**
   * @param {import('electron').BrowserWindow} window
   */
  constructor (window) {
    this.window = window

    protocol.registerHttpProtocol('shiru', (req, cb) => {
      const token = req.url.slice(7)
      this.window.loadURL(development ? 'http://localhost:5000/app.html' + token : `file://${path.join(__dirname, '/app.html')}${token}`)
    })

    app.on('open-url', (event, url) => {
      event.preventDefault()
      this.handleProtocol(url)
    })

    // Handle locally loaded extensions (test extensions)
    protocol.registerFileProtocol('extension', (request, callback) => {
      // Extract path after 'extension://'
      let filePath = request.url.replace('extension://', '')
      // Fix drive paths
      if (/^[A-Z]\//i.test(filePath)) filePath = filePath.charAt(0) + ':' + filePath.slice(1)
      callback({ path: filePath })
    })

    if (process.argv.length >= 2 && !process.defaultApp) {
      ipcMain.on('version', () => {
        for (const line of process.argv) {
          this.handleProtocol(line)
        }
      })
    }

    app.on('second-instance', (event, commandLine) => {
      // Someone tried to run a second instance, we should focus our window.
      ipcMain.emit('window-show')
      for (const line of commandLine) {
        this.handleProtocol(line)
      }
    })

    ipcMain.on('handle-protocol', (event, text) => {
      this.handleProtocol(text)
    })
  }

  /**
   * @param {string} line
   */
  sendToken (line) {
    let token = line.split('access_token=')[1].split('&token_type')[0]
    if (token) {
      if (token.endsWith('/')) token = token.slice(0, -1)
      this.window.webContents.send('altoken', token)
    }
  }

  /**
   * @param {string} line
   */
  sendMalToken (line) {
    let code = line.split('code=')[1].split('&state')[0]
    let state = line.split('&state=')[1]
    if (code && state) {
      if (code.endsWith('/')) code = code.slice(0, -1)
      if (state.endsWith('/')) state = state.slice(0, -1)
      if (state.includes('%')) state = decodeURIComponent(state)
      this.window.webContents.send('maltoken', code, state)
    } 
  }

  /**
   * @param {string} id - The media id.
   */
  play(id) {
    this.window.webContents.send('play-anime', id)
    ipcMain.emit('window-show')
  }

  /**
   * @param {string} text
   */
  handleProtocol (text) {
    if (!text) return

    // Handle shiru:// scheme
    const match = text.match(this.protocolRx)
    if (match) this.protocolMap[match[1]]?.(match[2])
    return match
  }
}
