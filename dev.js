#!/usr/bin/env node

const { execSync, spawn } = require('child_process')
const path = require('path')

const nodeBin = process.execPath
const webpackBin = path.join(__dirname, 'node_modules', 'webpack', 'bin', 'webpack.js')
const concurrentlyBin = path.join(__dirname, 'node_modules', 'concurrently', 'dist', 'bin', 'concurrently.js')
const electronBin = path.join(__dirname, 'node_modules', 'electron', 'cli.js')

const electronDir = path.join(__dirname, 'electron')

const env = {
  ...process.env,
  NODE_ENV: 'development'
}

console.log('Starting Tsumi dev server...\n')

try {
  console.log('[1/2] Building webpack...\n')
  execSync(`"${nodeBin}" "${webpackBin}" build`, {
    stdio: 'inherit',
    cwd: electronDir,
    env
  })

  console.log('\n[2/2] Starting dev server + Electron...\n')
  const child = spawn(nodeBin, [
    concurrentlyBin,
    '--kill-others',
    `"${nodeBin}" "${webpackBin}" serve`,
    `"${nodeBin}" "${electronBin}" ./build/main.js`
  ], {
    stdio: 'inherit',
    cwd: electronDir,
    env
  })

  child.on('exit', (code) => process.exit(code || 0))
} catch (error) {
  process.exit(error.status || 1)
}