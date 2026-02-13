import { autoUpdater } from 'electron-updater'
import { ipcMain, shell } from 'electron'

export default class Updater {
  hasUpdate = false
  downloading = false

  window
  availableInterval
  downloadedInterval

  /**
   * @param {import('electron').BrowserWindow} window
   */
  constructor (window) {
    this.window = window
    autoUpdater.autoInstallOnAppQuit = false
    ipcMain.on('update', () => autoUpdater.checkForUpdates())
    autoUpdater.on('error', () => this.window.webContents.send('update-aborted'))
    autoUpdater.on('update-available', (info) => {
      if (!this.downloading) {
        this.downloading = true
        this.availableInterval = setInterval(() => {
          if (!this.hasUpdate) this.window.webContents.send('update-available', info.version)
        }, 1_000)
        this.availableInterval.unref?.()
      }
    })
    autoUpdater.on('update-downloaded', (info) => {
      if (!this.hasUpdate) {
        this.hasUpdate = true
        clearInterval(this.availableInterval)
        this.downloadedInterval = setInterval(() => {
          if (this.hasUpdate) this.window.webContents.send('update-downloaded', info.version)
        }, 1_000)
        this.downloadedInterval.unref?.()
      }
    })
  }

  install (forceRunAfter = false) {
    if (this.hasUpdate && forceRunAfter) {
      setImmediate(() => {
        try {
          this.window.close()
        } catch (e) {}
        clearInterval(this.downloadedInterval)
        autoUpdater.quitAndInstall(true, true)
      })
      if (process.platform === 'darwin') shell.openExternal('https://github.com/50n50/Tsumi/releases/latest')
      this.hasUpdate = false
      return true
    }
    return false
  }
}