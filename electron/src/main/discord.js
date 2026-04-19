import { Client } from '@xhayper/discord-rpc'
import { ipcMain } from 'electron'
import { debounce } from '@/modules/util.js'

export default class Discord {
  defaultStatus = {
    activity: {
      timestamps: { start: Date.now() },
      details: 'Watching media on Tsumi',
      state: 'Browsing the library',
      assets: {
        large_image: 'icon',
        large_text: 'Tsumi — Media Streaming'
      },
      buttons: [
        {
          label: 'Get Tsumi',
          url: 'https://github.com/50n50/Tsumi/releases/latest'
        }
      ],
      instance: true,
      type: 3
    }
  }

  discord = new Client({ transport: { type: 'ipc' }, clientId: '1472362790013505607' })

  /** @type {string} */
  enableRPC = 'disabled'
  /** @type {Discord['defaultStatus'] | undefined} */
  cachedPresence

  /** @param {import('electron').BrowserWindow} window */
  constructor(window) {
    ipcMain.on('discord', (event, data) => {
      this.cachedPresence = data
      this.debouncedDiscordRPC(this.enableRPC === 'full' ? this.cachedPresence : undefined, this.enableRPC === 'disabled')
    })

    ipcMain.on('discord-rpc', (event, data) => {
      if (this.enableRPC !== data) {
        this.enableRPC = data
        if (data !== 'disabled') {
          if (!this.discord?.user) this.loginRPC()
          else this.debouncedDiscordRPC(this.enableRPC === 'full' ? this.cachedPresence : undefined)
        } else if (this.discord?.user) {
          this.debouncedDiscordRPC(undefined, true)
        }
      }
    })

    ipcMain.on('discord-clear', () => this.debouncedDiscordRPC(undefined, true))

    this.discord.on('ready', async () => {
      this.setDiscordRPC(this.enableRPC === 'full' ? this.cachedPresence : undefined)
      this.discord.subscribe('ACTIVITY_JOIN_REQUEST')
      this.discord.subscribe('ACTIVITY_JOIN')
      this.discord.subscribe('ACTIVITY_SPECTATE')
    })

    this.discord.on('disconnected', () => { if (this.enableRPC !== 'disabled') this.loginRPC() })

    this.discord.on('ACTIVITY_JOIN', ({ secret }) => window.webContents.send('w2glink', secret))
    this.debouncedDiscordRPC = debounce((status, clearActivity) => this.setDiscordRPC(status, clearActivity), 4_500)
  }

  loginRPC() {
    this.discord.login().catch(() => setTimeout(() => this.loginRPC(), 5_000).unref?.())
  }

  setDiscordRPC(data = this.defaultStatus, clearActivity = false) {
    if (clearActivity) {
      if (this.discord?.user) this.discord.user.clearActivity(process.pid)
    } else if (this.discord.user && data && this.enableRPC !== 'disabled') {
      /** @type {(value: any, limit: number) => any} */
      const toLimitedText = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : value
      /** @type {(value: any) => any} */
      const normalizeImageField = (value, key) => {
        if (typeof value !== 'string') return value
        if (key === 'large_image') return value.slice(0, 512)
        if (value.startsWith('mp:')) return toLimitedText(value, 1024)
        if (/^https?:\/\//.test(value)) return `mp:${encodeURI(value).slice(0, 1024)}`
        return toLimitedText(value, 128)
      }
      /** @type {any} */
      const activity = data?.activity ? { ...data.activity } : null
      if (!activity) return

      activity.details = toLimitedText(activity.details, 128)
      activity.state = toLimitedText(activity.state, 128)
      if (activity.assets) {
        activity.assets = {
          ...activity.assets,
          large_image: normalizeImageField(activity.assets.large_image, 'large_image'),
          large_text: toLimitedText(activity.assets.large_text, 128)
        }
        if (activity.assets.small_image) delete activity.assets.small_image
        if (activity.assets.small_text) delete activity.assets.small_text
      }
      if (Array.isArray(activity.buttons)) {
        /** @type {any[]} */
        const rpcButtons = activity.buttons
        activity.buttons = rpcButtons
          .filter((/** @type {any} */ button) => /^https?:\/\//.test(button?.url || ''))
          .slice(0, 2)
          .map((/** @type {any} */ button) => ({
            ...button,
            label: toLimitedText(button.label, 32),
            url: toLimitedText(button.url, 512)
          }))
        if (!activity.buttons.length) activity.buttons = undefined
      }

      this.discord.request('SET_ACTIVITY', { pid: process.pid, activity }).catch((error) => {
        console.warn('Discord RPC SET_ACTIVITY failed:', error?.message || error)
      })
    }
  }
}