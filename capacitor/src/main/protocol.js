//import { Filesystem } from '@capacitor/filesystem'
import { Browser } from '@capacitor/browser'
import { IPC } from '../preload/preload.js'
import { App } from '@capacitor/app'

export default class Protocol {
  // schema: shiru://key/value
  protocolMap = {
    alauth: token => this.sendToken(token),
    malauth: token => this.sendMalToken(token),
    anime: id => IPC.emit('open-anime', {id}),
    malanime: id => IPC.emit('open-anime', {id, mal: true}),
    torrent: magnet => this.add(magnet),
    search: id => this.play(id),
    w2g: link => IPC.emit('w2glink', link),
    schedule: () => IPC.emit('schedule'),
    donate: () => Browser.open({url: 'https://github.com/sponsors/RockinChaos/'}),
    update: () => IPC.emit('quit-and-install'),
    changelog: () => Browser.open({url: 'https://github.com/RockinChaos/Shiru/releases/latest'}),
    show: () => IPC.emit('window-show')
  }

  protocolRx = /shiru:\/\/([a-z0-9]+)\/(.*)/i

  constructor() {
    App.getLaunchUrl().then(res => {
      if (location.hash !== '#skipAlLogin') {
        location.hash = '#skipAlLogin'
        if (res) this.handleProtocol(res.url)
      } else {
        location.hash = ''
      }
    })
    App.addListener('appUrlOpen', ({ url }) => {
      // if (url.startsWith('content://')) handleTorrentFile(url)
      this.handleProtocol(url)
    })
  }

  /**
   * Handles opening a `.torrent` file and sends it as a `Uint8Array`
   * @param {string} fileUri - The path to the .torrent file
   */
// async handleTorrentFile(fileUri) {
//   const fileContents = await Filesystem.readFile({ path: fileUri })
//   const binaryString = atob(fileContents.data)
//   const uint8Array = new Uint8Array(binaryString.length)
//   for (let i = 0; i < binaryString.length; i++) uint8Array[i] = binaryString.charCodeAt(i)
//   if (uint8Array.length === 0) throw new Error('Empty file or conversion failed')
//   this.add(uint8Array)
// }

  /**
   * @param {string} line
   */
  sendToken(line) {
    let token = line.split('access_token=')[1].split('&token_type')[0]
    if (token) {
      if (token.endsWith('/')) token = token.slice(0, -1)
      IPC.emit('altoken', token)
    }
  }

  /**
   * @param {string} line
   */
  sendMalToken(line) {
    let code = line.split('code=')[1].split('&state')[0]
    let state = line.split('&state=')[1]
    if (code && state) {
      if (code.endsWith('/')) code = code.slice(0, -1)
      if (state.endsWith('/')) state = state.slice(0, -1)
      if (state.includes('%')) state = decodeURIComponent(state)
      IPC.emit('maltoken', code, state)
    }
  }

  /**
   * @param {string} id - The media id.
   */
  play(id) {
    IPC.emit('play-anime', id)
    IPC.emit('window-show')
  }

  /**
   * @param {string} magnet - The magnet link.
   */
  add(magnet) {
    IPC.emit('play-torrent', magnet)
    IPC.emit('window-show')
  }

  /**
   * @param {string} text
   */
  handleProtocol(text) {
    // Handle magnet links
    if (text.startsWith('magnet:')) {
      this.add(text)
      return
    }

    // Handle shiru:// scheme
    const match = text.match(this.protocolRx)
    if (match) this.protocolMap[match[1]]?.(match[2])
  }
}