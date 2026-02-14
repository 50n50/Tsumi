<script context='module'>
  import { settings } from '@/modules/settings.js'
  import { extensionManager, callExtensionFunction } from '@/modules/extension.js'
  import { files, nowPlaying as currentMedia } from '@/components/MediaHandler.svelte'
  import { page, modal } from '@/modules/navigation.js'
  import { anilistClient } from '@/modules/anilist.js'
  import { click } from '@/modules/click.js'
  import { toast } from 'svelte-sonner'
  import { parseStreamResponse } from '@/modules/streaming.js'
  import { X, Loader, Play, AlertTriangle } from 'lucide-svelte'
  import Debug from 'debug'
  const debug = Debug('ui:streams')

  function titleScore (searchTitle, resultTitle) {
    if (!searchTitle || !resultTitle) return 0
    const a = searchTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    const b = resultTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    if (a === b) return 100
    if (b.includes(a) || a.includes(b)) return 90
    const aWords = a.split(/\s+/)
    const bWords = b.split(/\s+/)
    const matches = aWords.filter(w => bWords.some(bw => bw === w || (w.length > 2 && bw.includes(w)))).length
    return Math.min(Math.round((matches / Math.max(aWords.length, 1)) * 80), 80)
  }
</script>

<script>
  import SmartImage from '@/components/visual/SmartImage.svelte'
  import { onDestroy } from 'svelte'
  import { getKitsuMappings, getEpisodeMetadataForMedia } from '@/modules/anime/anime.js'

  export let search
  export let close

  let loading = true
  let groupedResults = []
  let playingResult = null
  let expandedGroups = {}
  let autoPlayActive = false
  let autoPlayError = null

  $: defaultFailed = search?.defaultFailed
  $: failReason = search?.failReason

  async function searchExtensions () {
    loading = true
    groupedResults = []
    autoPlayActive = false
    autoPlayError = null
    const title = anilistClient.title(search?.media)
    if (!title) { loading = false; return }

    const enabled = extensionManager.getEnabled()
    if (!enabled.length) { loading = false; return }

    const defaultKey = settings.value.defaultExtension
    const starredKey = settings.value.starredExtension

    // Default extension auto-play is now handled by DefaultLoadingModal.
    // If we get here with defaultFailed, skip auto-play and do normal search.
    // If we get here without defaultFailed but with a default set, it means
    // playAnime was called with force=true, so also do normal search.

    // Normal flow: search all extensions, starred first
    const sorted = [...enabled].sort((a, b) => {
      if (a.key === starredKey && b.key !== starredKey) return -1
      if (b.key === starredKey && a.key !== starredKey) return 1
      return 0
    })

    const searches = sorted.map(ext => callExtensionFunction(ext, 'searchResults', title)
      .then(raw => {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(parsed) && parsed.length) {
          const scored = parsed.map(r => ({
            ...r,
            extensionKey: ext.key,
            extensionName: ext.manifest?.sourceName || ext.key,
            extensionIcon: ext.manifest?.iconUrl,
            score: titleScore(title, r.title)
          })).sort((a, b) => b.score - a.score)
          groupedResults = [...groupedResults, {
            extensionKey: ext.key,
            extensionName: ext.manifest?.sourceName || ext.key,
            extensionIcon: ext.manifest?.iconUrl,
            isStarred: ext.key === starredKey,
            results: scored
          }]
        }
      })
      .catch(error => debug(`Extension ${ext.key} search failed:`, error))
    )
    await Promise.allSettled(searches)
    loading = false
  }

  async function selectResult (result) {
    if (playingResult) return
    playingResult = result
    const ext = extensionManager.extensions.get(result.extensionKey)

    try {
      const rawEpisodes = await callExtensionFunction(ext, 'extractEpisodes', result.href)
      const parsedEpisodes = typeof rawEpisodes === 'string' ? JSON.parse(rawEpisodes) : rawEpisodes
      const episodes = Array.isArray(parsedEpisodes) ? parsedEpisodes : []

      if (!episodes.length) {
        toast.error('No episodes found for this title')
        playingResult = null
        return
      }

      const targetEp = episodes.find(ep => ep.number === search?.episode) || episodes[0]

      const raw = await callExtensionFunction(ext, 'extractStreamUrl', targetEp.href)
      let streamData
      try {
        streamData = parseStreamResponse(raw)
      } catch {
        const url = typeof raw === 'string' ? raw : raw?.url || raw?.streamUrl
        if (url) streamData = { url, headers: {}, subtitle: null }
      }

      if (!streamData?.url) {
        toast.error('No stream URL found for this episode')
        playingResult = null
        return
      }

      // Show server selector modal if multiple servers available
      if (streamData.servers && streamData.servers.length > 1) {
        const episodeNum = targetEp.number || search.episode
        const capturedStreamData = streamData
        playingResult = null
        modal.open(modal.SERVER_SELECTOR, {
          servers: capturedStreamData.servers,
          onSelect: (serverIndex) => {
            const server = capturedStreamData.servers[serverIndex]
            launchPlayer(capturedStreamData, episodeNum, serverIndex, server)
          },
          onBack: () => {}
        })
        return
      }

      const episodeNum = targetEp.number || search.episode
      launchPlayer(streamData, episodeNum, 0)
    } catch (error) {
      debug('Failed to get stream URL:', error)
      toast.error('Stream failed: ' + (error?.message || error))
      playingResult = null
    }
  }

  function launchPlayer(streamData, episodeNum, serverIndex = 0, server = null) {
    const url = server?.streamUrl || streamData.url
    const headers = server?.headers || streamData.headers || {}

    $currentMedia = { media: search.media, episode: episodeNum }
    files.set([{
      name: `${anilistClient.title(search.media)} - Episode ${episodeNum}.mp4`,
      url,
      streamHeaders: headers,
      streamServers: streamData.servers || [],
      subtitle: streamData.subtitle || null,
      length: 0,
      media: {
        media: search.media,
        episode: episodeNum,
        parseObject: { anime_title: anilistClient.title(search.media), episode_number: episodeNum }
      },
      activeServerIndex: serverIndex
    }])

    page.navigateTo(page.PLAYER)
    close()
  }

  $: if (search) searchExtensions()

  function toggleGroup (key) {
    expandedGroups[key] = !expandedGroups[key]
    expandedGroups = expandedGroups
  }

  onDestroy(() => {
    groupedResults = []
    playingResult = null
    search = null
  })
</script>

<div class='controls w-full bg-very-dark position-sticky top-0 z-10 pt-20 pb-10 px-30 mb-10'>
  <div class='d-flex'>
    <h3 class='mb-0 font-weight-bold text-white header-title mr-5 font-scale-40'>{anilistClient.title(search?.media)}</h3>
    <button type='button' class='btn btn-square bg-dark-very-light ml-auto d-flex align-items-center justify-content-center rounded-2 flex-shrink-0' use:click={close}><X size='1.7rem' strokeWidth='3'/></button>
    <div class='position-absolute top-0 left-0 w-full h-full z--1'>
      <div class='position-absolute w-full h-full overflow-hidden'>
        <SmartImage class='img-cover w-full h-full' images={[
          search.media.bannerImage,
          ...(search.media.trailer?.id ? [
            `https://i.ytimg.com/vi/${search.media.trailer.id}/maxresdefault.jpg`,
            `https://i.ytimg.com/vi/${search.media.trailer.id}/hqdefault.jpg`] : []),
          () => getKitsuMappings(search.media.id).then(metadata =>
            [metadata?.included?.[0]?.attributes?.coverImage?.original,
            metadata?.included?.[0]?.attributes?.coverImage?.large,
            metadata?.included?.[0]?.attributes?.coverImage?.small,
            metadata?.included?.[0]?.attributes?.coverImage?.tiny]),
          () => getEpisodeMetadataForMedia(search.media).then(metadata => metadata?.[1]?.image),
          search.media.coverImage?.extraLarge]}
        />
      </div>
      <div class='position-absolute top-0 left-0 w-full h-full' style='background: var(--extension-banner-gradient)' />
    </div>
  </div>
</div>

<div class='mt-10 mb-sm-10 px-30'>
  {#if defaultFailed}
    <div class='d-flex align-items-center bg-dark-light rounded p-15 mb-20'>
      <AlertTriangle size='2rem' class='text-warning mr-15 flex-shrink-0' />
      <div>
        <span class='font-weight-bold text-white font-scale-16'>Default extension failed</span>
        <span class='text-muted font-scale-14 d-block mt-3'>{failReason || 'Unable to auto-play from your default extension.'} Showing all results instead.</span>
      </div>
    </div>
  {/if}
  {#if loading}
      <div class='d-flex flex-column align-items-center justify-content-center mt-80'>
        <Loader size='4rem' class='spinning text-muted' />
        <span class='text-muted mt-20 font-scale-18'>Searching extensions...</span>
      </div>
    {:else if !groupedResults.length}
      <div class='d-flex flex-column align-items-center justify-content-center mt-80'>
        <h3 class='font-weight-bold'>Ooops!</h3>
        <span class='text-muted font-scale-18'>
          {#if !extensionManager.getEnabled().length}
            No extensions enabled. Add extensions in Settings → Extensions.
          {:else}
            No results found from any extension.
          {/if}
        </span>
      </div>
    {:else}
      {#each groupedResults as group}
        <div class='mb-20'>
          <div class='d-flex align-items-center mb-10'>
            {#if group.extensionIcon}
              <img class='ext-icon mr-5' src={group.extensionIcon} alt='' />
            {/if}
            <span class='font-weight-bold font-scale-18 text-white'>{group.extensionName}</span>
            {#if group.isStarred}
              <span class='badge bg-warning border-0 ml-10 font-scale-12'>Starred</span>
            {/if}
            <span class='text-muted ml-10 font-scale-14'>{group.results.length} result{group.results.length === 1 ? '' : 's'}</span>
          </div>
          <div class='results-grid' class:results-grid-collapsed={!expandedGroups[group.extensionKey]}>
            {#each group.results as result, i}
              <div class='d-flex p-15 position-relative'>
                <button type='button' class='item load-in small-card d-flex flex-column pointer border-0 p-0 text-left w-full' disabled={!!playingResult} use:click={() => selectResult(result)}>
                  <div class='d-inline-block position-relative w-full'>
                    {#if playingResult === result}
                      <div class='position-absolute w-full h-full d-flex align-items-center justify-content-center z-2'>
                        <Loader size='3rem' class='spinning text-white' />
                      </div>
                    {/if}
                    {#if result.image}
                      <SmartImage class='cover-img cover-color cover-ratio w-full rounded' color='var(--tertiary-color)' images={[result.image, './404_cover.png']}/>
                    {:else}
                      <div class='cover-ratio w-full rounded d-flex align-items-center justify-content-center' style='background: var(--dark-color-light)'>
                        <Play size='3rem' class='text-muted' />
                      </div>
                    {/if}
                  </div>
                  <div class='text-white font-weight-very-bold font-size-16 title overflow-hidden mt-5'>
                    {result.title}
                  </div>
                  <div class='d-flex flex-row mt-auto font-weight-medium justify-content-between w-full text-muted'>
                    <span class='badge border-0 font-scale-12 {result.score >= 80 ? "bg-success" : result.score >= 50 ? "bg-warning" : "bg-light"}'>{result.score}% match</span>
                  </div>
                </button>
              </div>
            {/each}
          </div>
          {#if group.results.length > 5 && !expandedGroups[group.extensionKey]}
            <span class='more-link text-muted font-scale-14 pointer mt-5 ml-15' use:click={() => toggleGroup(group.extensionKey)}>+ {group.results.length - 5} More</span>
          {:else if group.results.length > 5 && expandedGroups[group.extensionKey]}
            <span class='more-link text-muted font-scale-14 pointer mt-5 ml-15' use:click={() => toggleGroup(group.extensionKey)}>Show Less</span>
          {/if}
        </div>
      {/each}
    {/if}
</div>

<style>
  .controls {
    box-shadow: 0 1.2rem 1.2rem var(--dark-color-dim);
  }
  .header-title {
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    text-shadow: 2px 2px 4px hsla(var(--black-color-hsl), 1);
  }
  .title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.2;
  }
  .mt-80 {
    margin-top: 8rem;
  }
  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  }
  .results-grid-collapsed {
    max-height: 32rem;
    overflow: hidden;
  }
  .results-grid :global(.item.small-card) {
    max-width: 19rem;
  }
  .small-card {
    background: transparent;
    aspect-ratio: 152/296;
  }
  .small-card:hover {
    z-index: 30;
  }
  .small-card:disabled {
    opacity: 0.6;
  }
  .more-link {
    display: inline-block;
  }
  .more-link:hover {
    color: var(--white-color) !important;
  }
  .ext-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
  }
  :global(.spinning) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>