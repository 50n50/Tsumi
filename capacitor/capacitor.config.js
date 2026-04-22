const mode = process.env.NODE_ENV?.trim() || 'development'

const config = {
  appId: 'org.tsumi.app',
  appName: 'Tsumi',
  webDir: 'build',
  android: {
    buildOptions: {
      keystorePath: './tsumi',
      keystorePassword: '',
      keystoreAlias: 'tsumi'
    },
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
    CapacitorHttp: { enabled: true },
    CapacitorNodeJS: { nodeDir: 'nodejs' },
    LocalNotifications: { sound: 'ic_notification.wav' }
  },
  server: {
    cleartext: true
  }
}

if (mode === 'development') config.server.url = 'http://localhost:5001/index.html'

module.exports = config
