import { writable } from 'simple-store-svelte'

const noop = () => {}
export const client = { on: noop, off: noop, once: noop, emit: noop, removeListener: noop }
export const loadedTorrent = writable({})
export const stagingTorrents = writable([])
export const seedingTorrents = writable([])
export const completedTorrents = writable([])

export async function add() {}
export async function stage() {}
export async function unload() {}
export async function untrack() {}
export async function complete() {}
export async function reannounce() {}