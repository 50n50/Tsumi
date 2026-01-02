import { IPC } from '../preload/preload.js'
import { Device } from '@capacitor/device'

export default class Debug {
  constructor () {
    IPC.on('get-device-info', async () => {
      const deviceInfo = {
        features: {},
        info: await Device.getInfo(),
        cpu: {},
        ram: {}
      }
      IPC.emit('device-info', JSON.stringify(deviceInfo))
    })
  }
}