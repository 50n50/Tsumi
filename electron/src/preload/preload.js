import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('IPC', {
  emit: (event, data) => {
    ipcRenderer.send(event, data)
  },
  on: (event, callback) => {
    ipcRenderer.on(event, (event, ...args) => callback(...args))
  },
  once: (event, callback) => {
    ipcRenderer.once(event, (event, ...args) => callback(...args))
  },
  off: (event) => {
    ipcRenderer.removeAllListeners(event)
  },
  invoke: (event, data) => ipcRenderer.invoke(event, data)
})
contextBridge.exposeInMainWorld('version', {
  arch: process.arch,
  platform: process.platform,
  session: process.env.XDG_SESSION_TYPE || ''
})
contextBridge.exposeInMainWorld('bridge', {
  isMinimized: () => ipcRenderer.invoke('bridge:isMinimized'),
  isFullScreen: () => ipcRenderer.invoke('bridge:isFullScreen'),
  onMinimize: (callback) => ipcRenderer.on('bridge:onMinimize', (event, isMinimized) => callback(isMinimized)),
  onFullScreen: (callback) => ipcRenderer.on('bridge:onFullScreen', (event, isFullScreen) => callback(isFullScreen))
})

let _ports
ipcRenderer.once('port', ({ ports }) => {
  _ports = ports
  contextBridge.exposeInMainWorld('port', {
    onmessage: (cb) => {
      _ports[0].onmessage = ({ type, data }) => cb({ type, data })
    },
    postMessage: (a, b) => {
      _ports[0].postMessage(a, b)
    }
  })
  ipcRenderer.on('port', ({ ports }) => _ports = ports)
})