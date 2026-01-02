import { App } from '@capacitor/app'
import { IntentUri } from 'capacitor-intent-uri'
import { ForegroundService, Importance, ServiceType } from '@capawesome-team/capacitor-android-foreground-service'
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb'
import EventEmitter from 'events'

if (typeof localStorage === 'undefined') {
  const data = {}
  globalThis.localStorage = {
    setItem: (k, v) => { data[k] = v },
    getItem: (k) => data[k] || null
  }
}

if (typeof indexedDB === 'undefined') {
  globalThis.indexedDB = fakeIndexedDB
}

// cordova screen orientation plugin is also used, and it patches global screen.orientation.lock

// hook into pip request, and use our own pip implementation, then instantly report exit pip
// this is more like DOM PiP, rather than video PiP
HTMLVideoElement.prototype.requestPictureInPicture = function () {
  PictureInPicture.enter(this.videoWidth, this.videoHeight, success => {
    this.dispatchEvent(new Event('leavepictureinpicture'))
    if (success) document.querySelector('.content-wrapper').requestFullscreen()
  }, error => {
    this.dispatchEvent(new Event('leavepictureinpicture'))
    console.error(error)
  })
  return Promise.resolve({})
}

export const IPC = new EventEmitter()
const STREAMING_FG_ID = 1001
ForegroundService.createNotificationChannel({
  id: 'external-playback',
  name: 'External Playback',
  description: 'Keeps Video Streaming To An External Player Active',
  importance: Importance.Min
})

window.IPC = IPC
window.version = {
  platform: globalThis.cordova?.platformId,
  arch: navigator.platform?.split(' ')?.[1]
}
window.android = {
  /**
   * Requests "All Files" access permission when needed, resolves `true` if access is granted, or `false` if denied.
   *
   * @returns {Promise<boolean>} Resolves with `true` when access is granted, otherwise `false`.
   */
  requestFileAccess: async () => {
    if (window.NativeBridge?.hasAllFilesAccess()) return true
    window.NativeBridge?.requestAllFilesAccess()
    return new Promise((resolve) => {
      const listener = App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          listener.remove()
          if (window.NativeBridge?.hasAllFilesAccess()) resolve(true)
          else resolve(false)
        }
      })
    })
  },
  /**
   * Launches an external playback intent and shows a foreground service while playback is active, resolves when the app returns to the foreground.
   *
   * @param {string} url - The intent URL to launch externally.
   * @returns {Promise<void>} Resolves when the app returns and the service stops.
   */
  launchExternal: (url) => {
    ForegroundService.startForegroundService({
      id: STREAMING_FG_ID,
      title: 'External Playback',
      body: 'Delivering Content To Your External Player',
      smallIcon: 'ic_filled',
      notificationChannelId: 'external-playback',
      serviceType: ServiceType.MediaPlayback,
      silent: true
    })
    return new Promise((resolve) => {
      IntentUri.openUri({ url }).then(() => {
        ForegroundService.stopForegroundService()
        resolve()
      })
    })
  }
}