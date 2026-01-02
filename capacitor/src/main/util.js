import { Browser } from '@capacitor/browser'
import { IPC } from '../preload/preload.js'
import { App } from '@capacitor/app'

export const development = process.env.NODE_ENV?.trim() === 'development'

IPC.on('open', url => Browser.open({ url }))
IPC.once('version', async () => {
  const { version } = await App.getInfo()
  IPC.emit('version', version)
})