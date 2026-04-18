<script context='module'>
  import SectionsManager from '@/modules/sections.js'
  import SearchPage from '@/routes/search/SearchPage.svelte'
  import { writable } from 'simple-store-svelte'
  import { anilistClient } from '@/modules/anilist.js'
  import { nextAiring } from '@/modules/anime/anime.js'
  import { animeSchedule } from '@/modules/anime/animeschedule.js'
  import { cache, caches } from '@/modules/cache.js'
  import { tmdbClient } from '@/modules/tmdb.js'

  const key = writable({})
  const search = writable(cache.getEntry(caches.HISTORY, 'lastSchedule') || { scheduleList: true, western: false, format: ['TV'], format_not: [], genre: [], genre_not: [], tag: [], tag_not: [], status: [], status_not: [] })
  search.subscribe(value => {
    const searched = { ...value }
    delete searched.load
    delete searched.preview
    cache.setEntry(caches.HISTORY, 'lastSchedule', searched)
  })

  async function fetchAllScheduleEntries (variables) {
    const getAiringTime = (m) => {
      const node = nextAiring(m?.airingSchedule?.nodes, variables)
      if (!node?.airingAt) return Infinity
      const time = Number(node.airingAt)
      return time < 10000000000 ? time * 1000 : time
    }

    const fetchAnime = async () => {
      const results = { data: { Page: { media: [], pageInfo: { hasNextPage: false } } } }
      const airingLists = await (variables.hideSubs ? animeSchedule.dubAiringLists.value : animeSchedule.subAiringLists.value)
      if (!airingLists?.length) return results
      let ids = airingLists.map(entry => {
          const media = variables.hideSubs ? entry.media?.media : entry
          return media?.id ? { id: media.id, idMal: media.idMal ?? null } : null
      }).filter(item => item != null)
      // Hide My Anime / Show My Anime
      if ((variables.hideMyAnime || variables.showMyAnime) && Helper.isAuthorized()) {
        const userIds = await Helper.userLists(variables).then(res => {
          if (!res?.data && res?.errors) throw res.errors[0]
          if (Helper.isAniAuth()) return Array.from(new Set(res.data.MediaListCollection.lists.filter(({ status }) => (variables.hideMyAnime ? variables.hideStatus : variables.showStatus).includes(status)).flatMap(list => list.entries.map(({ media }) => media.id))))
          else return res.data.MediaList.filter(({ node }) => (variables.hideMyAnime ? variables.hideStatus : variables.showStatus).includes(Helper.statusMap(node.my_list_status.status))).map(({ node }) => node.id)
        })
        ids = ids.filter(({ id, idMal }) => Helper.isAniAuth() ? variables.hideMyAnime ? !userIds.includes(id) : userIds.includes(id) : variables.hideMyAnime ? !userIds.includes(idMal) : userIds.includes(idMal))
      }
      const res = await anilistClient.searchAllIDS({ id: ids.map(({ id }) => id).filter(Boolean), ...SectionsManager.sanitiseObject(variables), page: 1, perPage: 50 })
      if (!res?.data && res?.errors) throw res.errors[0]
      results.data.Page.media = results.data.Page.media.concat(res.data.Page.media)
      if (variables.hideSubs) {
        // filter out entries without airing schedule, duplicates [only allow first occurrence], and completed dubs, then sort entries from first airing to last airing.
        results.data.Page.media = results.data.Page.media.filter((media, index, self) => {
          const cachedItem = airingLists.find(entry => entry.media?.media?.id === media.id)
          if (cachedItem?.delayedIndefinitely && cachedItem?.status?.toUpperCase()?.includes('FINISHED')) { // skip these as they are VERY likely partial dubs so production isn't necessarily in a suspended state.
            return false
          }
          const numberOfEpisodes = cachedItem.subtractedEpisodeNumber ? (cachedItem.episodeNumber - cachedItem.subtractedEpisodeNumber) : 1
          let predict = false
          if (cachedItem?.media?.media?.airingSchedule?.nodes?.length) {
              const now = new Date()
              const futureEpisodes = cachedItem.media.media.airingSchedule.nodes.filter(node => new Date(node.airingAt) > now)
              predict = futureEpisodes.length === 0
              if (predict && !((numberOfEpisodes > 4) && !cachedItem.unaired)) {
                  const latestEpisode = Math.max(...cachedItem.media.media.airingSchedule.nodes.map(node => node.episode))
                  const latestAiringAt = Math.max(...cachedItem.media.media.airingSchedule.nodes.map(node => new Date(node.airingAt).getTime()))
                  cachedItem.media.media.airingSchedule.nodes.unshift({
                      episode: latestEpisode + 1,
                      airingAt: new Date(latestAiringAt + (cachedItem.delayedIndefinitely ? 6 * 365 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000)).toISOString().slice(0, -5) + 'Z'
                  })
              }
          }
          return (!(cachedItem?.media?.media?.airingSchedule?.nodes[0]?.episode > media.episodes) || !media.episodes) && (!predict || !((numberOfEpisodes > 4) && !cachedItem.unaired)) && cachedItem?.media?.media?.airingSchedule?.nodes[0]?.airingAt && self.findIndex(m => m.id === media.id) === index
        })
      } else {
        // filter out entries without airing schedule and duplicates [only allow first occurrence]
        results.data.Page.media = results.data.Page.media.filter((media, index, self) => nextAiring(media?.airingSchedule?.nodes)?.airingAt && self.findIndex(m => m?.id === media?.id) === index)
      }
      return results
    }

    let animeRes = { data: { Page: { media: [], pageInfo: { hasNextPage: false } } } }
    let tmdbRes = { data: { Page: { media: [], pageInfo: { hasNextPage: false } } } }

    const fetches = []
    // Only fetch anime on the first page as it's a static list for the week
    if (variables.western !== true && (variables.page || 1) === 1) {
      fetches.push(fetchAnime().then(res => animeRes = res).catch(() => {}))
    }
    if (variables.western !== false) {
      fetches.push(tmdbClient.getSchedule(variables.page || 1).then(res => tmdbRes = res).catch(() => {}))
    }
    
    await Promise.all(fetches)

    const mixedMedia = [...(animeRes?.data?.Page?.media || []), ...(tmdbRes?.data?.Page?.media || [])]
    
    // Final duplicate filter and universal sort
    const seenIds = new Set()
    const sortedMedia = mixedMedia
      .filter(m => {
        if (!m || seenIds.has(m.id)) return false
        seenIds.add(m.id)
        return nextAiring(m?.airingSchedule?.nodes, variables)
      })
      .sort((a, b) => getAiringTime(a) - getAiringTime(b))

    return {
      data: {
        Page: {
          pageInfo: { hasNextPage: (animeRes?.data?.Page?.pageInfo?.hasNextPage && (variables.page || 1) === 1) || tmdbRes?.data?.Page?.pageInfo?.hasNextPage },
          media: sortedMedia
        }
      }
    }
  }
</script>

<script>
  $search.load = (page, __, variables) => SectionsManager.wrapResponse(fetchAllScheduleEntries({ ...variables, page }), 150)
</script>

<SearchPage key={key} search={search}/>
