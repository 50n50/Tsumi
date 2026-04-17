import Bottleneck from 'bottleneck'
import { cache, caches } from '@/modules/cache.js'
import { anilistClient } from '@/modules/anilist.js'
import Debug from 'debug'
const debug = Debug('ui:tmdb')

const TMDB_API_KEY = atob('OTgwMWI2YjA1NDhhZDU3NTgxZDExMWVhNjkwYzg1Yzg=')

const TMDB_GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
}

const TMDB_GENRE_NAME_TO_ID = Object.fromEntries(Object.entries(TMDB_GENRES).map(([id, name]) => [name, Number(id)]))

export const tmdbGenreList = [
  'Action', 'Action & Adventure', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Kids',
  'Music', 'Mystery', 'Reality', 'Romance', 'Sci-Fi', 'Sci-Fi & Fantasy',
  'Thriller', 'War', 'War & Politics', 'Western'
]

class TMDBClient {
  limiter = new Bottleneck({
    reservoir: 40,
    reservoirRefreshAmount: 40,
    reservoirRefreshInterval: 1000,
    maxConcurrent: 20,
    minTime: 25
  })

  rateLimitPromise = null
  animeMap = []
  tmdbToAnilist = {}
  anilistToTmdb = {}

  constructor() {
    debug('Initializing TMDB Client')
    this.limiter.on('failed', async (error) => {
      debug('Rate limit or error hit', error)
      if (error.status === 429) {
        const resetTime = (Number(error.headers?.get('retry-after')) || 10) * 1000
        if (!this.rateLimitPromise) this.rateLimitPromise = new Promise(resolve => setTimeout(resolve, resetTime))
        return resetTime
      }
      return null
    })

    this.mapPromise = this.fetchAnimeMap()
  }

  tvdbToken = null;
  tvdbTokenExpiry = 0;

  async getTvdbToken() {
    if (this.tvdbToken && Date.now() < this.tvdbTokenExpiry) return this.tvdbToken;
    try {
      const res = await fetch('https://api4.thetvdb.com/v4/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: '2fa11d19-0298-4c09-9a20-b5ae84a07619' })
      });
      const data = await res.json();
      if (data?.data?.token) {
        this.tvdbToken = data.data.token;
        this.tvdbTokenExpiry = Date.now() + 1000 * 60 * 60 * 23;
        return this.tvdbToken;
      }
    } catch (e) {
      debug('TVDB login failed', e);
    }
    return null;
  }

  async fetchAnimeMap() {
    debug('Fetching TMDB/TVDB to Anilist mappings...')
    try {
      const res = await fetch('https://animap.s0n1c.ca/mappings/all')
      const json = await res.json()
      if (json && typeof json === 'object') {
        const arr = Object.values(json)
        this.animeMap = arr
        for (const item of arr) {
          if (item.anilist_id) {
            const tmdbId = item.tmdb_movie_id || item.tmdb_show_id
            if (tmdbId) {
              const tmdbType = item.tmdb_movie_id ? 'movie' : 'tv'
              this.tmdbToAnilist[`${tmdbType}-${tmdbId}`] = item.anilist_id
            }
            this.anilistToTmdb[item.anilist_id] = {
              id: tmdbId,
              type: item.media_type || (item.tmdb_movie_id ? 'MOVIE' : 'TV'),
              anime_planet_id: item.animeplanet_id || '',
              tvdb_id: item.tvdb_id,
              tvdb_season: item.tvdb_season,
              tvdb_epoffset: item.tvdb_epoffset
            }
          }
        }
      }
      debug(`Loaded ${this.animeMap.length} animap mappings`)
    } catch (e) {
      debug('Failed to load anime mappings', e)
    }
  }

  handleRequest = this.limiter.wrap(async (endpoint, params = {}) => {
    await this.rateLimitPromise
    const url = new URL(`https://api.themoviedb.org/3${endpoint.toLowerCase()}`)
    url.searchParams.append('api_key', TMDB_API_KEY)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.append(key, value)
    }

    const res = await fetch(url)
    if (!res.ok) throw res
    return await res.json()
  })

  getTmdbGenre(id) {
    return TMDB_GENRES[id] || 'Unknown'
  }

  normalizeMedia(tmdbItem) {
    if (!tmdbItem) return null
    const isTv = tmdbItem.media_type === 'tv' || tmdbItem.first_air_date
    const tmdbType = isTv ? 'tv' : 'movie'
    const id = tmdbItem.id
    const anilistId = this.tmdbToAnilist[`${tmdbType}-${id}`]

    return {
      id: anilistId || `tmdb-${id}`,
      idTmdb: id,
      originalLanguage: tmdbItem.original_language,
      title: {
        romaji: tmdbItem.name || tmdbItem.original_name || tmdbItem.title || tmdbItem.original_title || 'Unknown Title',
        english: tmdbItem.name || tmdbItem.title || tmdbItem.original_name || tmdbItem.original_title || 'Unknown Title',
        native: tmdbItem.original_name || tmdbItem.original_title || tmdbItem.name || tmdbItem.title || 'Unknown Title',
        userPreferred: tmdbItem.name || tmdbItem.title || tmdbItem.original_name || tmdbItem.original_title || 'Unknown Title'
      },
      coverImage: {
        extraLarge: tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : null,
        medium: tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w342${tmdbItem.poster_path}` : null,
        color: null
      },
      bannerImage: tmdbItem.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbItem.backdrop_path}` : null,
      description: tmdbItem.overview,
      format: isTv ? 'TV' : 'MOVIE',
      episodes: isTv ? null : 1,
      averageScore: tmdbItem.vote_average ? Math.round(tmdbItem.vote_average * 10) : null,
      popularity: tmdbItem.popularity,
      isAdult: tmdbItem.adult || false,
      genres: (tmdbItem.genre_ids || []).map(id => this.getTmdbGenre(id)),
      tags: [],
      seasonYear: tmdbItem.first_air_date ? parseInt(tmdbItem.first_air_date.substring(0, 4)) : (tmdbItem.release_date ? parseInt(tmdbItem.release_date.substring(0, 4)) : null),
      status: tmdbItem.status ?
        (['Ended', 'Canceled'].includes(tmdbItem.status) ? 'FINISHED' : ['Returning Series', 'Released', 'In Production', 'Post Production', 'Pilot'].includes(tmdbItem.status) ? 'RELEASING' : 'NOT_YET_RELEASED') :
        ((tmdbItem.release_date || tmdbItem.first_air_date) ? (new Date(tmdbItem.release_date || tmdbItem.first_air_date) <= new Date() ? 'RELEASING' : 'NOT_YET_RELEASED') : 'RELEASING'),
      isTmdb: true,
      logo: tmdbItem.images?.logos?.find(l => l.iso_639_1 === 'en') || tmdbItem.images?.logos?.[0] ? `https://image.tmdb.org/t/p/w500${(tmdbItem.images?.logos?.find(l => l.iso_639_1 === 'en') || tmdbItem.images?.logos?.[0]).file_path}` : null
    }
  }

  async search(variables = {}) {
    debug('TMDB Search', variables)

    let sort = variables.sort
    if (Array.isArray(sort)) sort = sort[0]

    const formats = Array.isArray(variables.format_in) ? variables.format_in : (variables.format ? (Array.isArray(variables.format) ? variables.format : [variables.format]) : [])
    const fetchMovies = formats.length === 0 || formats.includes('MOVIE')
    const fetchTv = formats.length === 0 || formats.includes('TV')
    const types = []
    if (fetchMovies) types.push('movie')
    if (fetchTv) types.push('tv')

    const getGenreIds = (t, exclude) => {
      const genres = exclude ? (variables.genre_not || []) : (variables.tmdbGenres || variables.genre || [])
      if (genres.length === 0) return []
      return genres.map(name => {
        const id = TMDB_GENRE_NAME_TO_ID[name]
        if (t === 'tv') {
          if (name === 'Action' || name === 'Adventure') return 10759
          if (name === 'Sci-Fi' || name === 'Fantasy') return 10765
          if (name === 'Horror' || name === 'Thriller') return 9648
          if (name === 'War') return 10768
          if (name === 'Romance') return 10766
        }
        if (t === 'movie') {
          if (name === 'Action & Adventure') return [28, 12]
          if (name === 'Sci-Fi & Fantasy') return [878, 14]
          if (name === 'War & Politics') return 10752
        }
        return id
      }).flat().filter(id => {
        const movieIds = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37]
        const tvIds = [10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10763, 10764, 10765, 10766, 10767, 10768, 37]
        return t === 'movie' ? movieIds.includes(id) : tvIds.includes(id)
      })
    }

    const fetchResults = await Promise.all(types.map(async (type) => {
      let endpoint = `/discover/${type}`
      let params = { page: variables.page || 1 }

      const genreIds = getGenreIds(type)
      const excludeGenreIds = getGenreIds(type, true)
      const hasGenres = genreIds.length > 0
      const hasYear = !!variables.year
      const isTrending = sort === 'TRENDING_DESC' || !sort

      if (isTrending && !hasGenres && !hasYear && !variables.excludeAnime && excludeGenreIds.length === 0) {
        endpoint = `/trending/${type}/week`
      } else {
        endpoint = `/discover/${type}`
        if (isTrending || sort === 'POPULARITY_DESC' || sort === 'TRENDING_DESC') {
          params.sort_by = 'popularity.desc'
        } else if (sort.includes('POPULARITY')) params.sort_by = sort.includes('DESC') ? 'popularity.desc' : 'popularity.asc'
        else if (sort.includes('SCORE')) params.sort_by = sort.includes('DESC') ? 'vote_average.desc' : 'vote_average.asc'
        else if (sort.includes('DATE') || sort.includes('START_DATE')) params.sort_by = sort.includes('DESC') ? (type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc') : (type === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc')
        else if (sort.includes('TITLE')) params.sort_by = sort.includes('DESC') ? (type === 'movie' ? 'original_title.desc' : 'original_name.desc') : (type === 'movie' ? 'original_title.asc' : 'original_name.asc')

        if (hasGenres) params.with_genres = genreIds.join(',')
        if (excludeGenreIds.length > 0) params.without_genres = excludeGenreIds.join(',')
        if (hasYear) params[type === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = variables.year
        if (variables.excludeAnime) params.without_original_language = 'ja,zh,ko'
      }

      try {
        const res = await this.handleRequest(endpoint, params)
        return { type, res }
      } catch (e) {
        debug(`Fetch failed for ${type}`, e)
        return { type, res: { results: [], total_pages: 0 } }
      }
    }))

    let results = []
    let hasNextPage = false

    const movieRes = fetchResults.find(r => r.type === 'movie')?.res
    const tvRes = fetchResults.find(r => r.type === 'tv')?.res

    const movieItems = movieRes?.results || []
    const tvItems = tvRes?.results || []

    hasNextPage = (movieRes?.page < movieRes?.total_pages) || (tvRes?.page < tvRes?.total_pages)

    const maxLength = Math.max(movieItems.length, tvItems.length)
    for (let i = 0; i < maxLength; i++) {
      if (movieItems[i]) results.push(this.normalizeMedia(movieItems[i]))
      if (tvItems[i]) results.push(this.normalizeMedia(tvItems[i]))
    }

    if (types.length > 1) {
      results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    }

    for (let i = 0; i < results.length; i++) {
      const resList = results[i]
      const tmdbType = resList.format === 'TV' ? 'tv' : 'movie'
      const anilistId = this.tmdbToAnilist[`${tmdbType}-${resList.idTmdb}`]
      if (anilistId) {
        try {
          const aniQuery = await anilistClient.searchIDSingle({ id: anilistId })
          if (aniQuery?.data?.Media) {
            const anilistMedia = aniQuery.data.Media
            results[i] = {
              ...anilistMedia,
              ...results[i],
              genres: anilistMedia.genres,
              tags: anilistMedia.tags,
              episodes: anilistMedia.episodes,
              stats: anilistMedia.stats,
              relations: anilistMedia.relations,
              id: anilistId
            }
          }
        } catch (e) {
          debug('Failed to merge anilist id:', anilistId, e)
        }
      }
    }

    await cache.updateMedia(results)

    return {
      data: {
        Page: {
          pageInfo: {
            hasNextPage
          },
          media: results
        }
      }
    }
  }

  getSchedule = this.limiter.wrap(async (variables = {}) => {
    debug('TMDB Schedule', variables)
    const { page = 1 } = variables

    try {
      let res = await this.handleRequest('/tv/on_the_air', { page }).catch(() => ({ results: [] }))
      if (!res.results || res.results.length === 0) {
        res = await this.handleRequest('/tv/popular', { page }).catch(() => ({ results: [] }))
      }

      const detailedResults = await Promise.all((res.results || []).map(async (item) => {
        try {
          const details = await this.getDetails(item.id, 'tv')
          const ep = details?.next_episode_to_air || details?.last_episode_to_air
          if (ep) {
            const media = this.normalizeMedia({ ...item, ...details })
            media.next_episode_to_air = details.next_episode_to_air
            media.last_episode_to_air = details.last_episode_to_air
            const airDate = ep.air_date ? new Date(ep.air_date) : new Date()
            media.airingSchedule = {
              nodes: [{
                episode: ep.episode_number,
                airingAt: Math.floor(airDate.getTime() / 1000)
              }]
            }
            return media
          }
        } catch (e) {
        }
        return null
      }))

      const mediaList = detailedResults.filter(Boolean).sort((a, b) => {
        const aTime = a.airingSchedule?.nodes?.[0]?.airingAt || 0
        const bTime = b.airingSchedule?.nodes?.[0]?.airingAt || 0
        return bTime - aTime
      })

      await cache.updateMedia(mediaList)
      return {
        data: {
          Page: {
            pageInfo: { hasNextPage: res.page < res.total_pages },
            media: mediaList
          }
        }
      }
    } catch (e) {
      return { data: { Page: { pageInfo: { hasNextPage: false }, media: [] } } }
    }
  })

  async injectMediaImages(mediaList) {
    if (!mediaList || !mediaList.length) return mediaList
    if (this.mapPromise) await this.mapPromise
    await Promise.resolve()

    const promises = mediaList.map(async (media, idx) => {
      let tmdbId, isMovie
      if (media.isTmdb) {
        tmdbId = media.idTmdb || (typeof media.id === 'string' ? media.id.replace('tmdb-', '') : media.id)
        isMovie = media.format === 'MOVIE' || media.mediaType === 'movie' || media.media_type === 'movie'
      } else {
        const tmdbInfo = this.anilistToTmdb[media.id] || this.anilistToTmdb[media.idMal]
        if (!tmdbInfo) return
        tmdbId = tmdbInfo.id
        isMovie = tmdbInfo.type === 'MOVIE'

        if (!tmdbId && tmdbInfo.tvdb_id) {
          const findRes = await this.handleRequest(`/find/${tmdbInfo.tvdb_id}`, { external_source: 'tvdb_id' }).catch(() => null)
          const result = findRes?.tv_results?.[0] || findRes?.movie_results?.[0]
          if (result) {
            tmdbId = result.id
            tmdbInfo.id = tmdbId
            isMovie = result.media_type === 'movie' || (!findRes?.tv_results?.[0] && !!findRes?.movie_results?.[0])
          }
        }
      }

      if (!tmdbId) return
      const cacheKey = `tmdb-banner-${tmdbId}`
      const cached = cache.getEntry(caches.MEDIA, cacheKey)
      if (cached && cached.logo !== undefined) {
        if (cached.backdrop || cached.logo) {
          mediaList[idx] = {
            ...media,
            bannerImage: cached.backdrop || media.bannerImage,
            logo: cached.logo || media.logo
          }
        }
        return
      }

      try {
        const endpoint = isMovie ? `/movie/${tmdbId}` : `/tv/${tmdbId}`
        let tmdbMedia = await this.handleRequest(endpoint, { append_to_response: 'images', include_image_language: 'en,null,ja' }).catch(() => null)

        let backdropPath = tmdbMedia ? tmdbMedia.backdrop_path : null
        const backdrop = backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : null

        let logo = tmdbMedia?.images?.logos?.find(l => l.iso_639_1 === 'en') || tmdbMedia?.images?.logos?.find(l => l.iso_639_1 === null) || tmdbMedia?.images?.logos?.[0]
        const logoUrl = logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : null

        cache.setEntry(caches.MEDIA, cacheKey, { backdrop, logo: logoUrl })

        if (backdrop || logoUrl) {
          mediaList[idx] = {
            ...media,
            bannerImage: backdrop || media.bannerImage,
            logo: logoUrl || media.logo
          }
        }
      } catch (e) {
      }
    })

    await Promise.all(promises)
    await cache.updateMedia(mediaList)
    return mediaList
  }

  async injectTmdbImages(anilistResults) {
    if (!anilistResults || !anilistResults.data || !anilistResults.data.Page || !anilistResults.data.Page.media) return anilistResults
    await this.injectMediaImages(anilistResults.data.Page.media)
    return anilistResults
  }

  getMediaForRSS(page = 1, perPage = 50) {
    const res = this._getMediaForRSS(page, perPage)
    return Array.from({ length: perPage }, (_, i) => ({ type: 'episode', data: this.fromPending(res, i) }))
  }

  async _getMediaForRSS(page, perPage) {
    try {
      const data = await this.getSchedule({ page })
      const mediaList = data?.data?.Page?.media || []
      const results = mediaList.map(media => {
        const nextEp = media.next_episode_to_air
        const lastEp = media.last_episode_to_air
        const ep = nextEp || lastEp
        if (!ep) return null

        return {
          media,
          episode: ep.episode_number,
          date: ep.air_date ? new Date(ep.air_date) : null,
          episodeData: {
            image: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : media.backdrop,
            title: { en: ep.name }
          },
          onclick: () => {
            window.dispatchEvent(new CustomEvent('play-media', {
              detail: { media, episode: ep.episode_number }
            }))
            return true
          }
        }
      }).filter(Boolean)

      return results
    } catch (e) {
      console.error('[TMDB] _getMediaForRSS failed:', e)
      return []
    }
  }

  async fromPending(result, i) {
    const array = await result
    if (!array || !array[i]) return undefined
    return array[i]
  }

  async getDetails(tmdbId, mediaType = 'tv') {
    const typeKey = (mediaType || 'tv').toLowerCase()
    const cacheKey = `tmdb-details-v2-${typeKey}-${tmdbId}`
    const cached = cache.getEntry(caches.GENERAL, cacheKey)
    if (cached) return cached

    try {
      const type = mediaType?.toLowerCase() === 'movie' ? 'movie' : 'tv'
      const ratingEndpoint = type === 'movie' ? 'release_dates' : 'content_ratings'
      const append = `videos,credits,recommendations,similar,external_ids,keywords,watch/providers,${ratingEndpoint},images`
      const data = await this.handleRequest(`/${type}/${tmdbId}`, { append_to_response: append })
      if (!data) return null

      const trailerVideo = data.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.videos?.results?.find(v => v.site === 'YouTube')

      const details = {
        id: tmdbId,
        mediaType,
        title: data.name || data.title,
        description: data.overview,
        genres: (data.genres || []).map(g => g.name),
        tags: (data.keywords?.results || data.keywords?.keywords || []).map(k => ({ name: k.name, rank: 50 })),
        rating: mediaType === 'movie'
          ? (data.release_dates?.results?.find(r => r.iso_3166_1 === 'US')?.release_dates?.[0]?.certification || 'NR')
          : (data.content_ratings?.results?.find(r => r.iso_3166_1 === 'US')?.rating || 'NR'),
        isAdult: data.adult || false,
        externalIds: data.external_ids || {},
        streamingProviders: data['watch/providers']?.results?.US?.flatrate || [],
        staff: (data.credits?.crew || [])
          .filter(person => ['Director', 'Writer', 'Screenplay', 'Creator', 'Original Series Creator'].includes(person.job))
          .map(person => ({ name: person.name, role: person.job, image: person.profile_path })),
        characters: (data.credits?.cast || []).slice(0, 15).map(actor => ({
          name: actor.character,
          actorName: actor.name,
          image: actor.profile_path
        })),
        status: ['Ended', 'Canceled'].includes(data.status) ? 'FINISHED' : ['Returning Series', 'Released', 'In Production', 'Post Production', 'Pilot'].includes(data.status) ? 'RELEASING' : 'NOT_YET_RELEASED',
        averageScore: data.vote_average ? Math.round(data.vote_average * 10) : null,
        episodes: mediaType === 'movie' ? 1 : data.number_of_episodes,
        duration: mediaType === 'movie' ? data.runtime : (data.episode_run_time?.[0] || null),
        seasonYear: data.first_air_date ? parseInt(data.first_air_date.substring(0, 4)) : (data.release_date ? parseInt(data.release_date.substring(0, 4)) : null),
        releaseDate: data.release_date || data.first_air_date,
        runtime: data.runtime || data.episode_run_time?.[0],
        seasons: mediaType === 'tv' ? (data.seasons || []).filter(s => s.season_number > 0) : [],
        numberOfSeasons: data.number_of_seasons || 0,
        poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
        backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
        trailer: trailerVideo ? { id: trailerVideo.key, site: 'youtube' } : null,
        networks: (data.networks || []).map(n => n.name),
        studios: (data.production_companies || []).map(c => c.name),
        recommendations: data.recommendations?.results || [],
        similar: data.similar?.results || [],
        last_episode_to_air: data.last_episode_to_air,
        belongs_to_collection: data.belongs_to_collection
      }

      cache.setEntry(caches.GENERAL, cacheKey, details)
      return details
    } catch (e) {
      console.error('[TMDB] getDetails failed', e)
      return null
    }
  }

  async getSeasonEpisodes(tmdbId, seasonNumber) {
    const cacheKey = `tmdb-season-${tmdbId}-${seasonNumber}`
    const cached = cache.getEntry(caches.GENERAL, cacheKey)
    if (cached) return cached

    try {
      const data = await this.handleRequest(`/tv/${tmdbId}/season/${seasonNumber}`)
      if (!data?.episodes) return []

      const episodes = data.episodes.map(ep => ({
        episode: ep.episode_number,
        title: ep.name,
        summary: ep.overview,
        image: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
        airdate: ep.air_date ? new Date(ep.air_date) : null,
        length: ep.runtime,
        rating: ep.vote_average ? Math.round(ep.vote_average * 10) : null,
        seasonNumber: seasonNumber
      }))

      cache.setEntry(caches.GENERAL, cacheKey, episodes)
      return episodes
    } catch (e) {
      debug('getSeasonEpisodes failed', e)
      return []
    }
  }

  async getCollection(collectionId) {
    const cacheKey = `tmdb-collection-${collectionId}`
    const cached = cache.getEntry(caches.GENERAL, cacheKey)
    if (cached) return cached

    try {
      const data = await this.handleRequest(`/collection/${collectionId}`)
      if (!data?.parts) return []

      const parts = data.parts.map(item => this.normalizeMedia(item)).filter(Boolean)
      if (parts.length > 0) await cache.updateMedia(parts)

      cache.setEntry(caches.GENERAL, cacheKey, parts)
      return parts
    } catch (e) {
      debug('getCollection failed', e)
      return []
    }
  }

  async getRelations(tmdbId, mediaType = 'tv') {
    if (mediaType === 'movie') {
      const details = await this.getDetails(tmdbId, 'movie')
      if (details?.belongs_to_collection?.id) {
        const parts = await this.getCollection(details.belongs_to_collection.id)
        // Sort by release date so sequels appear in order
        const sorted = parts.sort((a, b) => (a.seasonYear || 0) - (b.seasonYear || 0))
        // Map to relations format for UI (relations usually have relationType)
        return {
          relations: sorted.filter(p => p.idTmdb !== tmdbId).map(p => ({
            node: p,
            relationType: (p.seasonYear < details.seasonYear) ? 'PREQUEL' : 'SEQUEL'
          })),
          recommendations: []
        }
      }
    }
    return { relations: [], recommendations: [] }
  }

  async getRecommendations(tmdbId, mediaType = 'tv') {
    const details = await this.getDetails(tmdbId, mediaType)
    if (!details) return { relations: [], recommendations: [] }

    const allRecs = [...(details.recommendations || []), ...(details.similar || [])]
    const seen = new Set()
    const uniqueRecs = allRecs.filter(item => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })

    const normalized = uniqueRecs.map(item => this.normalizeMedia(item)).filter(Boolean)
    if (normalized.length > 0) await cache.updateMedia(normalized)

    return { relations: [], recommendations: normalized }
  }

  async getTrailer(media) {
    if (media.trailer?.id) return media
    const mediaType = media.format === 'MOVIE' ? 'movie' : 'tv'
    const tmdbId = media.idTmdb
    if (!tmdbId) return null

    const details = await this.getDetails(tmdbId, mediaType)
    if (details?.trailer) return { trailer: details.trailer }
    return null
  }

  async textSearch(query, page = 1) {
    if (!query || query.length === 0) return { data: { Page: { pageInfo: { hasNextPage: false }, media: [] } } }

    try {
      const data = await this.handleRequest('/search/multi', { query, page, include_adult: false })
      const results = (data.results || [])
        .filter(item => item.media_type === 'tv' || item.media_type === 'movie')
        .map(item => this.normalizeMedia(item))
        .filter(Boolean)

      const filtered = results.filter(item => {
        const tmdbType = item.format === 'TV' ? 'tv' : 'movie'
        const isMapped = !!this.tmdbToAnilist[`${tmdbType}-${item.idTmdb}`]
        const isAnime = ['ja', 'zh', 'ko'].includes(item.originalLanguage) || isMapped

        return !isAnime
      })

      if (filtered.length > 0) await cache.updateMedia(filtered)

      return {
        data: {
          Page: {
            pageInfo: { hasNextPage: data.page < data.total_pages },
            media: filtered
          }
        }
      }
    } catch (e) {
      debug('textSearch failed', e)
      return { data: { Page: { pageInfo: { hasNextPage: false }, media: [] } } }
    }
  }
}

export const tmdbClient = new TMDBClient()
