const commonConfig = require('common/webpack.config.cjs')
const { merge } = require('webpack-merge')
const { join, resolve } = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const mode = process.env.NODE_ENV?.trim() || 'development'

const alias = {
  '@/modules/support.js': join(__dirname, 'src', 'main', 'support.js'),
  '@': resolve(__dirname, '..', 'common')
}

/** @type {import('webpack').Configuration} */
const capacitorConfig = {
  devtool: 'source-map',
  entry: [join(__dirname, 'src', 'background', 'background.js')],
  output: {
    path: join(__dirname, 'build', 'nodejs'),
    filename: 'index.js'
  },
  mode,
  externals: {
    bridge: 'require("bridge")',
    'utp-native': 'require("utp-native")',
    'fs-native-extensions': 'commonjs2 fs-native-extensions',
    'require-addon': 'commonjs2 require-addon'
  },
  resolve: {
    aliasFields: [],
    mainFields: ['module', 'main', 'node'],
    alias: {
      ...alias,
      wrtc: false,
      'node-datachannel': false,
      '@client': resolve(__dirname, '..', 'client'),
      'webrtc-polyfill': false,
      'webpack/hot/emitter.js': resolve(__dirname, '../node_modules/.pnpm/webpack@5.104.1_webpack-cli@6.0.1/node_modules/webpack/hot/emitter.js'),
      'webpack/hot/log.js': resolve(__dirname, '../node_modules/.pnpm/webpack@5.104.1_webpack-cli@6.0.1/node_modules/webpack/hot/log.js')
    }
  },
  target: 'node',
  devServer: {
    devMiddleware: {
      writeToDisk: true
    },
    hot: true,
    client: {
      overlay: { errors: true, warnings: false, runtimeErrors: false }
    },
    port: 5001
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: join(__dirname, 'public', 'nodejs') }
      ]
    })
  ]
}

module.exports = [capacitorConfig, merge({ entry: [join(__dirname, 'src', 'main', 'main.js')] }, commonConfig(__dirname, alias, 'browser', 'index'))]
