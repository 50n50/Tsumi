<script context='module'>
  import { settings } from '@/modules/settings.js'
  import { extensionManager, callExtensionFunction } from '@/modules/extension.js'
  import { files, nowPlaying as currentMedia } from '@/components/MediaHandler.svelte'
  import { page } from '@/modules/navigation.js'
  import { anilistClient } from '@/modules/anilist.js'
  import { click } from '@/modules/click.js'
  import { toast } from 'svelte-sonner'
  import { parseStreamResponse } from '@/modules/streaming.js'
  import { X, ChevronLeft, Loader, Play } from 'lucide-svelte'
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

  const VIEW_SEARCH = 'search'
  const VIEW_EPISODES = 'episodes'

  let view = VIEW_SEARCH
  let loading = true
  let groupedResults = []
  let selectedResult = null
  let episodes = []
  let loadingEpisodes = false
  let playingEpisode = null
  let selectedExtension = null

  async function searchExtensions () {
    loading = true
    groupedResults = []
    const title = anilistClient.title(search?.media)
    if (!title) { loading = false; return }

    const enabled = extensionManager.getEnabled()
    if (!enabled.length) { loading = false; return }

    const defaultKey = settings.value.defaultExtension
    const sorted = defaultKey
      ? [...enabled].sort((a, b) => (a.key === defaultKey ? -1 : b.key === defaultKey ? 1 : 0))
      : enabled

    for (const ext of sorted) {
      try {
        const raw = await callExtensionFunction(ext, 'searchResults', title)
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
            isDefault: ext.key === defaultKey,
            results: scored
          }]
        }
      } catch (error) {
        debug(`Extension ${ext.key} search failed:`, error)
      }
    }
    loading = false
  }

  async function selectResult (result) {
    selectedResult = result
    selectedExtension = extensionManager.extensions.get(result.extensionKey)
    view = VIEW_EPISODES
    loadingEpisodes = true
    episodes = []

    try {
      const raw = await callExtensionFunction(selectedExtension, 'extractEpisodes', result.href)
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      episodes = Array.isArray(parsed) ? parsed : []
    } catch (error) {
      debug('Failed to fetch episodes:', error)
      toast.error('Failed to fetch episodes: ' + (error?.message || error))
    }
    loadingEpisodes = false
  }

  async function playEpisode (episode) {
    if (playingEpisode) return
    playingEpisode = episode.number || episode.href

    try {
      const raw = await callExtensionFunction(selectedExtension, 'extractStreamUrl', episode.href)
      let streamData
      try {
        streamData = parseStreamResponse(raw)
      } catch {
        const url = typeof raw === 'string' ? raw : raw?.url || raw?.streamUrl
        if (url) streamData = { url, headers: {}, subtitle: null }
      }

      if (!streamData?.url) {
        toast.error('No stream URL found for this episode')
        playingEpisode = null
        return
      }

      $currentMedia = { media: search.media, episode: episode.number || search.episode }

      const episodeNum = episode.number || search.episode
      files.set([{
        name: `${anilistClient.title(search.media)} - Episode ${episodeNum}.mp4`,
        url: streamData.url,
        streamHeaders: streamData.headers || {},
        subtitle: streamData.subtitle || null,
        length: 0,
        media: {
          media: search.media,
          episode: episodeNum,
          parseObject: { anime_title: anilistClient.title(search.media), episode_number: episodeNum }
        }
      }])

      page.navigateTo(page.PLAYER)
      close()
    } catch (error) {
      debug('Failed to get stream URL:', error)
      toast.error('Stream failed: ' + (error?.message || error))
      playingEpisode = null
    }
  }

  $: if (search) searchExtensions()

  function goBack () {
    view = VIEW_SEARCH
    selectedResult = null
    episodes = []
    selectedExtension = null
    playingEpisode = null
  }

  onDestroy(() => {
    groupedResults = []
    selectedResult = null
    episodes = []
    selectedExtension = null
    playingEpisode = null
    search = null
  })
</script>

<div class='controls w-full bg-very-dark position-sticky top-0 z-10 pt-20 pb-10 px-30 mb-10'>
  <div class='d-flex'>
    {#if view === VIEW_EPISODES}
      <button type='button' class='btn btn-square bg-dark-very-light mr-10 d-flex align-items-center justify-content-center rounded-2 flex-shrink-0' use:click={goBack}><ChevronLeft size='1.7rem' strokeWidth='3'/></button>
    {/if}
    <h3 class='mb-0 font-weight-bold text-white title mr-5 font-scale-40'>{anilistClient.title(search?.media)}</h3>
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
      <div class='position-absolute top-0 left-0 w-full h-full' style='background: var(--torrent-banner-gradient)' />
    </div>
  </div>
  {#if view === VIEW_EPISODES && selectedResult}
    <div class='mt-10 d-flex align-items-center'>
      <span class='text-muted font-scale-16'>Source: {selectedResult.extensionName}</span>
      <span class='mx-10 text-muted'>•</span>
      <span class='text-muted font-scale-16'>{selectedResult.title}</span>
      {#if episodes.length}
        <span class='mx-10 text-muted'>•</span>
        <span class='text-muted font-scale-16'>{episodes.length} episodes</span>
      {/if}
    </div>
  {/if}
</div>

<div class='mt-10 mb-sm-10 px-30'>
  {#if view === VIEW_SEARCH}
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
            {#if group.isDefault}
              <span class='badge bg-primary border-0 ml-10 font-scale-12'>Default</span>
            {/if}
            <span class='text-muted ml-10 font-scale-14'>{group.results.length} result{group.results.length === 1 ? '' : 's'}</span>
          </div>
          <div class='results-row'>
            {#each group.results as result, i}
              {@const isBest = i === 0 && result.score >= 70}
              <button type='button' class='result-card rounded-3 overflow-hidden border-0 p-0 text-left pointer flex-shrink-0' class:best-match={isBest} use:click={() => selectResult(result)}>
                <div class='d-flex flex-column h-full'>
                  {#if result.image}
                    <img class='result-image w-full' src={result.image} alt={result.title} loading='lazy' />
                  {:else}
                    <div class='result-image-placeholder w-full d-flex align-items-center justify-content-center bg-dark'>
                      <Play size='2rem' class='text-muted' />
                    </div>
                  {/if}
                  <div class='p-10 d-flex flex-column flex-grow-1'>
                    <div class='font-weight-bold font-scale-14 text-white result-title'>{result.title}</div>
                    <div class='d-flex align-items-center mt-auto pt-5'>
                      <span class='badge border-0 font-scale-12 {result.score >= 80 ? "bg-success" : result.score >= 50 ? "bg-warning" : "bg-light"}'>{result.score}%</span>
                    </div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  {:else if view === VIEW_EPISODES}
    {#if loadingEpisodes}
      <div class='d-flex flex-column align-items-center justify-content-center mt-80'>
        <Loader size='4rem' class='spinning text-muted' />
        <span class='text-muted mt-20 font-scale-18'>Loading episodes...</span>
      </div>
    {:else if !episodes.length}
      <div class='d-flex flex-column align-items-center justify-content-center mt-80'>
        <h3 class='font-weight-bold'>No Episodes Found</h3>
        <span class='text-muted font-scale-18'>This source returned no episodes.</span>
      </div>
    {:else}
      <div class='episodes-grid'>
        {#each episodes as episode}
          {@const isTarget = episode.number === (search?.episode || 1)}
          {@const isPlaying = playingEpisode === (episode.number || episode.href)}
          <button type='button'
            class='episode-card d-flex align-items-center rounded-2 p-10 border-0 pointer w-full'
            class:bg-primary={isTarget}
            class:bg-dark-light={!isTarget}
            disabled={!!playingEpisode}
            use:click={() => playEpisode(episode)}>
            <div class='d-flex align-items-center justify-content-center episode-number flex-shrink-0'>
              {#if isPlaying}
                <Loader size='1.8rem' class='spinning' />
              {:else}
                <Play size='1.6rem' />
              {/if}
            </div>
            <span class='ml-10 font-weight-semi-bold font-scale-16'>Episode {episode.number}</span>
            {#if isTarget}
              <span class='ml-auto badge bg-light border-0 pl-10 pr-10 font-scale-14'>Requested</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .controls {
    box-shadow: 0 1.2rem 1.2rem var(--dark-color-dim);
  }
  .title {
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    text-shadow: 2px 2px 4px hsla(var(--black-color-hsl), 1);
  }
  .mt-80 {
    margin-top: 8rem;
  }
  .results-row {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    overflow-y: visible;
    padding-bottom: 1rem;
    padding-top: 0.5rem;
    padding-left: 0.3rem;
    padding-right: 0.3rem;
    scroll-snap-type: x mandatory;
  }
  .results-row::-webkit-scrollbar {
    height: 0.4rem;
  }
  .results-row::-webkit-scrollbar-thumb {
    background: var(--gray-color-very-dim);
    border-radius: 0.4rem;
  }
  .result-card {
    width: 16rem;
    min-width: 16rem;
    background: var(--dark-color-light);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    scroll-snap-align: start;
  }
  .result-card:hover {
    transform: scale(1.03);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .best-match {
    box-shadow: inset 0 0 0 2px var(--primary-color);
  }
  .best-match:hover {
    box-shadow: inset 0 0 0 2px var(--primary-color), 0 4px 12px rgba(0,0,0,0.3);
  }
  .result-image {
    height: 20rem;
    object-fit: cover;
  }
  .result-image-placeholder {
    height: 20rem;
  }
  .result-title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .ext-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
  }
  .episodes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
    gap: 0.8rem;
  }
  .episode-card {
    transition: transform 0.1s ease;
  }
  .episode-card:hover {
    transform: translateY(-1px);
  }
  .episode-number {
    width: 3.6rem;
    height: 3.6rem;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
  }
  :global(.spinning) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>