import { getRandomInt, matchPhrase } from '@/modules/util.js'
import { printError,  status } from '@/modules/networking.js'
import { cache, caches } from '@/modules/cache.js'
import { writable } from 'simple-store-svelte'
import Debug from 'debug'
const debug = Debug('ui:animedubs')

/**
 * Dub information is returned as MyAnimeList ids.
 */
class MALDubs {
    /** @type {import('simple-store-svelte').Writable<ReturnType<MALDubs['getDubs']>>} */
     dubLists = writable(Promise.resolve([]))

    constructor() {
        this.dubLists.value = this.getMALDubs()
        //  update dubLists every hour
        setInterval(async () => {
            try {
                const updatedLists = await this.getMALDubs()
                this.dubLists.value = Promise.resolve(updatedLists)
            } catch (error) {
                debug('Failed to update dubbed anime list at the scheduled interval, this is likely a temporary connection issue:', JSON.stringify(error))
            }
        }, 1000 * 60 * 60)
    }

    async isDubMedia(media) {
        if ((await this.dubLists.value)?.dubbed) {
            if (media?.idMal) {
                return (await this.dubLists.value).dubbed.includes(media.idMal) || (await this.dubLists.value).incomplete.includes(media.idMal)
            } else if (media?.language || media?.file_name) {
                return matchPhrase(media?.language, 'English', 3) || matchPhrase(media?.file_name, ['Multi Audio', 'Dual Audio', 'English Audio', 'English Dub'], 3) || matchPhrase(media?.file_name, ['Dual', 'Dub'], 1)
            }
        }
    }

    async getMALDubs() {
        debug('Getting MyAnimeList Dubs IDs')
        try {
            const cachedEntry = await cache.cachedEntry(caches.RSS, 'MALDubs', true)
            if (status.value === 'offline' && cachedEntry) return cachedEntry
            let res = {}
            try {
                res = await fetch(`${atob('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL01BTC1EdWJzL01BTC1EdWJzL21haW4vZGF0YS9kdWJJbmZvLmpzb24=')}?timestamp=${new Date().getTime()}`)
            } catch (error) {
                if (!res || res.status !== 404) throw error
            }
            if (!res.ok && (res.status === 429 || res.status === 500)) throw res
            let json = null
            try {
                json = await res.json()
            } catch (error) {
                if (res.ok && !cachedEntry) printError('Dub Caching Failed', 'Failed to load dub information!', error)
            }
            if (!res.ok) {
                if (json) {
                    for (const error of json?.errors || []) {
                        if (!cachedEntry) printError('Dub Caching Failed', 'Failed to load dub information!', error)
                    }
                } else if (!cachedEntry) printError('Dub Caching Failed', 'Failed to load dub information!', res)
            } else if (json) return await cache.cacheEntry(caches.RSS, 'MALDubs', { mappings: true }, json, Date.now() + getRandomInt(100, 200) * 60 * 1000)
            else throw res
        } catch (error) {
            const cachedEntry = await cache.cachedEntry(caches.RSS, 'MALDubs', true)
            if (cachedEntry) {
                debug(`Failed to request MALDubs RSS, this is likely due to an outage... falling back to cached data.`)
                return cachedEntry
            }
            else throw error
        }
    }
}

export const malDubs = new MALDubs()