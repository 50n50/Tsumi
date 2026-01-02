import { readFile } from 'node:fs/promises'
import os from 'node:os'
import { app, ipcMain } from 'electron'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'

log.initialize({ spyRendererConsole: true })
log.transports.file.level = 'debug'
log.transports.file.maxSize = 10_000_000 // 10MB
autoUpdater.logger = log

export default class Debug {
  constructor () {
    ipcMain.on('get-log-contents', async ({ sender }) => ipcMain.emit('log-contents', sender, await readFile(log.transports.file.getFile().path, 'utf8')))
    ipcMain.on('reset-log-contents', async ({ sender }) => sender.send('log-reset', { success: await log.transports.file.getFile().clear() }))
    ipcMain.on('get-device-info', async ({ sender }) => {
      const { model, speed } = os.cpus()[0]
      const deviceInfo = {
        features: app.getGPUFeatureStatus(),
        info: await app.getGPUInfo('complete'),
        cpu: { model, speed },
        ram: os.totalmem()
      }
      sender.send('device-info', JSON.stringify(deviceInfo))
    })
  }
}