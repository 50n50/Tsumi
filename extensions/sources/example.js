import AbstractSource from './abstract.js'

/**
 * Example torrent source extension that generates dummy search results for testing and development.
 *
 * @remarks
 * This extension demonstrates the complete implementation pattern for torrent sources,
 * including all required extension methods (single, batch, movie, validate) and proper result formatting.
 *
 * **Installation:**
 * - Local: Direct path to index.json
 * - Remote: `gh:50n50/Tsumi/extensions`
 *
 * **Remote URL formats:**
 * - GitHub: `gh:username/repo/path`
 * - npm: `npm:package-name`
 * - Direct: `https://example.com/index.json` (must be ESM-compatible module)
 *
 * @extends AbstractSource
 */
export default new class DummySource extends AbstractSource {
  /**
   * Base URL for the torrent source.
   * Used by the validate() method to check source availability and should be used in the extensions query method.
   *
   * @example 'https://feed.example.org/json'
   * @example 'https://dummy.example.com/api'
   */
  url = 'https://www.google.com'

  /**
   * Generates dummy torrent results based on query parameters
   * @param {string} searchType Type of search (single, batch, movie)
   * @param {Object} query Query object with titles, resolution, episode, etc.
   * @returns {import('./').TorrentResult[]} Array of torrent results matching the query parameters.
   */
  #query(searchType, query) {
    const baseDate = new Date('2026-01-09')
    const { titles = ['Unknown Anime'], resolution = '1080', episode, episodeCount } = query
    const baseTitle = titles[0]
    const res = resolution || '1080'
    const getEpisodeInfo = () => {
      if (searchType === 'movie') return ''
      if (searchType === 'batch') return episodeCount ? `01-${episodeCount}` : '01-12'
      return episode ? String(episode).padStart(2, '0') : '01'
    }
    const getSize = (singleSize, batchSize, movieSize) => {
      if (searchType === 'movie') return movieSize
      if (searchType === 'batch') return batchSize
      return singleSize
    }
    const randomize = (base, variance = 0.4) => {
      const min = base * (1 - variance)
      const max = base * (1 + variance)
      return Math.max(1, Math.floor(Math.random() * (max - min + 1) + min))
    }
    const randomizeFloat = (base, variance = 0.15) => {
      const min = base * (1 - variance)
      const max = base * (1 + variance)
      return Math.max(0.1, min + Math.random() * (max - min))
    }
    const episodeInfo = getEpisodeInfo()

    /** @returns {import('./').TorrentResult[]} Array of torrent results matching the query parameters. */
    return [
      {
        title: `[QuickSubs] ${baseTitle}${searchType === 'movie' ? '' : ` - ${episodeInfo}`} (${res}p)`,
        link: 'magnet:?xt=urn:btih:' + 'A'.repeat(40) + '&dn=dummy_torrent_1',
        seeders: randomize(153),
        leechers: randomize(25),
        downloads: randomize(5_000),
        hash: 'A'.repeat(40),
        size: randomizeFloat(getSize(1.5, 12, 3.5)) * 1_024 * 1_024 * 1_024,
        accuracy: 'high',
        type: searchType === 'batch' ? 'batch' : undefined,
        date: new Date(baseDate.getTime() - 1_843_400_000)
      },
      {
        title: `${baseTitle}${searchType === 'movie' ? '' : ` - ${episodeInfo}`} [${res}p] Multi-Sub`,
        link: 'magnet:?xt=urn:btih:' + 'B'.repeat(40) + '&dn=dummy_torrent_2',
        seeders: randomize(327),
        leechers: randomize(45),
        downloads: randomize(8_500),
        hash: 'B'.repeat(40),
        size: randomizeFloat(getSize(0.8, 8, 2.8)) * 1_024 * 1_024 * 1_024,
        accuracy: 'low',
        type: searchType === 'batch' ? 'batch' : undefined,
        date: new Date(baseDate.getTime() - 200_000)
      },
      {
        title: `[FastEncode] ${baseTitle}${searchType === 'movie' ? '' : ` - ${episodeInfo}`} (${res}p) [HEVC]`,
        link: 'magnet:?xt=urn:btih:' + 'C'.repeat(40) + '&dn=dummy_torrent_3',
        seeders: randomize(512),
        leechers: randomize(80),
        downloads: randomize(12_000),
        hash: 'C'.repeat(40),
        size: randomizeFloat(getSize(1.2, 15, 4.5)) * 1_024 * 1_024 * 1_024,
        accuracy: 'medium',
        type: searchType === 'batch' ? 'batch' : undefined,
        date: new Date(baseDate.getTime() - 45_700_000)
      },
      {
        title: `[DualTrack] ${baseTitle}${searchType === 'movie' ? '' : ` - ${episodeInfo} -`} ${res}p [Dual Audio]`,
        link: 'magnet:?xt=urn:btih:' + 'D'.repeat(40) + '&dn=dummy_torrent_4',
        seeders: randomize(74),
        leechers: randomize(12),
        downloads: randomize(2_500),
        hash: 'D'.repeat(40),
        size: randomizeFloat(getSize(2.0, 20, 5.2)) * 1_024 * 1_024 * 1_024,
        accuracy: 'high',
        type: searchType === 'batch' ? 'batch' : undefined,
        date: new Date(baseDate.getTime() - 20_000_000)
      }
    ]
  }

  /** @type {import('./').SearchFunction} */
  async single({ anidbEid, resolution, exclusions, titles, episode }) {
    return this.#query('single', { titles, resolution, episode })
  }

  /** @type {import('./').SearchFunction} */
  async batch({ anidbAid, resolution, episodeCount, exclusions, titles }) {
    return this.#query('batch', { titles, resolution, episodeCount })
  }

  /**
   * @type {import('./').SearchFunction}
   *
   * @remarks
   * Results from this method are currently optional. If there is no feasible way to verify
   * whether a result is a movie, use the `single` method instead and return an empty array here.
   */
  async movie({ anidbAid, resolution, exclusions, titles }) {
    return this.#query('movie', { titles, resolution })
  }

  /**
   * Checks if the source URL is reachable.
   *
   * @remarks
   * This method enables health checking and failover capabilities for sources.
   * Implementations can validate against multiple fallback URLs and dynamically
   * switch to a working endpoint for the current session when primary sources fail.
   *
   * @example
   * // Example implementation with failover
   * const mirrors = ['https://primary.com', 'https://backup.com']
   * for (const mirror of mirrors) {
   *   if (await fetch(mirror).ok) {
   *     this.url = mirror
   *     break
   *   }
   * }
   *
   * @returns {() => Promise<boolean>} True if fetch succeeds.
   */
  async validate() {
    return (await fetch(this.url))?.ok
  }
}()