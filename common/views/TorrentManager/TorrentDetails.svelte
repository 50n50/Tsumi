<script context='module'>
  import { Database, Clapperboard, Projector, EllipsisVertical } from 'lucide-svelte'
  import { onDestroy, onMount, getContext } from 'svelte'
  import { settings } from '@/modules/settings.js'
</script>
<script>
  import { fastPrettyBytes } from '@/modules/util.js'
  import { add, stage, unload, untrack, complete } from '@/modules/torrent/torrent.js'
  import { click } from '@/modules/click.js'
  import { eta, createListener } from '@/modules/util.js'
  import { mediaCache } from '@/modules/cache.js'
  import { anilistClient } from '@/modules/anilist.js'
  import AnimeResolver from '@/modules/anime/animeresolver.js'
  import { getId } from '@/modules/anime/animehash.js'
  export let data
  export let current = false
  export let completed = false
  export let disableRescan = false

  const view = getContext('view')
  const infoHash = data.infoHash

  function ratioType(ratio, progress) {
    if ((Math.round(ratio * 100) / 100 <= 0 || progress < 1) && !data.incomplete) return 'Leeching'
    else if (ratio < 0.5) return 'Leecher'
    else if (ratio < 1.0) return 'Fair'
    else if (ratio < 2.5) return 'Good'
    return 'Seeder'
  }

  let resolved = getResolvedId(infoHash)
  $: if (current) resolved = getResolvedId(data.infoHash)
  window.addEventListener('fileEdit', () => getResolvedId(infoHash))
  function getResolvedId(infoHash) {
    return getId(infoHash, { client: true }, true)
  }

  $: resolvedId = resolved?.mediaId
  $: episode = resolved?.files?.length <= 1 ? !resolved?.files?.length ? resolved?.episode : (Number.isFinite(Number(resolved?.files?.[0]?.episode)) ? Number(resolved?.files?.[0]?.episode) : resolved?.episode) : null
  $: episodeRange = resolved?.files?.length <= 1 ? !resolved?.files?.length ? (resolved?.episodeRange && `${resolved.episodeRange.first} ~ ${resolved.episodeRange.last}`) : (resolved?.files?.[0]?.episodeRange && `${resolved?.files?.[0].episodeRange.first} ~ ${resolved?.files?.[0].episodeRange.last}`) || (resolved?.episodeRange && `${resolved.episodeRange.first} ~ ${resolved.episodeRange.last}`) : null

  function viewMedia() {
    $view = $mediaCache[resolvedId]
  }

  function altClick() {
    if (resolvedId && $mediaCache[resolvedId]) viewMedia()
    else if (completed) stage(infoHash, null, infoHash)
    else if (data.progress === 1) complete(infoHash)
  }

  let options
  function toggleDropdown () {
    options.classList.toggle('active')
    options.closest('.dropdown').classList.toggle('show')
  }

  const { reactive, init } = createListener([`react-${infoHash}`])
  const { reactive: _reactive, init: _init } = createListener([`react-${infoHash}`])
  onMount(() => {
    init(true, true)
    _init(true)
    reactive.subscribe(value => {
      if (!value && options) {
        const dropdown = options.closest('.dropdown')
        if (dropdown.classList.contains('show')) {
          options.classList.toggle('active')
          dropdown.classList.toggle('show')
        }
      }
    })
  })
  onDestroy(() => {
    init(false, true)
    _init(false)
  })
</script>
<div role='button' tabindex='0' class='details border-top py-20 text-wrap text-break-word d-flex {$_reactive && !current ? `` : `not-reactive`}' class:bg-error={completed && data.incomplete} class:current={current} class:option={!current} class:pointer={!current} class:not-allowed={current} aria-label={!current ? 'Play Torrent' : 'Currently Playing'} title={!current ? 'Play Torrent' : 'Currently Playing'} use:click={() => { if (!current) add(infoHash, null, infoHash) }} on:contextmenu|preventDefault={altClick}>
  <div class='d-flex flex-row w-full load-in mw-0'>
    <div class='p-5 ml-20 name mw-150 flex-1 w-auto d-flex flex-column'>
      {#if resolvedId && $mediaCache[resolvedId]}
        <div class='font-weight-bold line-2 overflow-hidden d-flex align-items-center justify-content-center' title={`${anilistClient.title($mediaCache[resolvedId])}${(episode || episode === 0) ? ` Episode ${episode}` : ``}`}>
          {#if episodeRange || episode || episode === 0}
            <span class='mr-2 d-inline-flex align-items-center justify-content-center align-middle bg-primary-dim px-3 rounded mb-5' title={`Episode ${episodeRange || episode}`}><Clapperboard size='2rem' class='mr-5'/><span class='mt-2 mr-2'>{episodeRange || episode}</span></span>
          {:else if $mediaCache[resolvedId]?.format === 'MOVIE'}
            <span class='mr-2 d-inline-flex align-items-center align-middle bg-primary-dim px-3 py-3 rounded mb-5' title='Movie'><Projector size='2rem'/></span>
          {:else}
            <span class='mr-2 d-inline-flex align-items-center align-middle bg-primary-dim px-3 py-3 rounded mb-5' title='Batch'><Database size='2rem'/></span>
          {/if}
          <span>{anilistClient.title($mediaCache[resolvedId])}</span>
        </div>
      {/if}
      <div class='text-muted line-2 overflow-hidden' title={data.name && AnimeResolver.cleanFileName(data.name)}>{(data.name && AnimeResolver.cleanFileName(data.name)) || '—'}</div>
    </div>
    <div class='p-5 w-150 d-none d-md-block'>{fastPrettyBytes(data.size)}</div>
    <div class='p-5 w-150'>{data.size && !data.missing_pieces ? `${((data.progress * 100) || 0).toFixed(1)}%` : (data.missing_pieces ? '—' : '0.0%')}</div>
    <div class='p-5 w-150'>{completed ? (data.incomplete ? (data.missing_pieces ? 'Missing Pieces' : 'Incomplete') : 'Completed') : data.progress === 1 ? 'Seeding' : data.size && (data.downloadSpeed || data.uploadSpeed) ? 'Downloading' : !(data.downloadSpeed || data.uploadSpeed) && data.eta > 1000 && data.eta < Infinity && data.progress < 1 && !settings.value.torrentStreamedDownload ? 'Scanning' : data.name ? 'Stalled' : '—'}</div>
    <div class='p-5 w-150 d-none d-md-block'>{!completed && data.name && (data.progress ? ((Math.ceil((data.ratio || 0) * 100) / 100)?.toFixed(2)) : '0.00') || (data.incomplete && !data.missing_pieces ? '0.01' : '—')}<span class='text-muted text-nowrap' class:d-none={(completed && (!data.incomplete || data.missing_pieces)) || !data.name}>{` (${ratioType(data.ratio || 0, data.progress)})`}</span></div>
    <div class='p-5 w-150'>{completed ? '—' : `${fastPrettyBytes(data.downloadSpeed || 0)}/s`}</div>
    <div class='p-5 w-150 d-none d-md-block'>{completed ? '—' : `${fastPrettyBytes(data.uploadSpeed || 0)}/s`}</div>
    <div class='p-5 w-150'>{completed ? '—' : data.numSeeders || 0}<span class='text-muted text-nowrap' class:d-none={completed}>{` (${data.totalSeeders || 0})`}</span></div>
    <div class='p-5 w-150 d-none d-md-block'>{completed ? '—' : data.numLeechers || 0}<span class='text-muted text-nowrap' class:d-none={completed}>{` (${data.numPeers || 0})`}</span></div>
    <div class='p-5 w-115 d-none d-md-block'>{data.eta > 0 && data.progress < 1 ? eta(new Date(Date.now() + data.eta)) : '∞'}</div>
  </div>
  <div class='dropdown react-{infoHash} with-arrow right-0 mr-5 mr-md-20 w-40 h-auto' class:invisible={current} use:click={toggleDropdown}>
    <span bind:this={options} class='btn btn-square h-full bg-transparent shadow-none border-0 options d-flex align-items-center muted justify-content-center flex-shrink-0 h-full w-40' title='Options'><EllipsisVertical size='2rem' /></span>
    <div class='dropdown-menu dropdown-menu-right pt-5 pb-5 ml-10 text-capitalize w-auto hm-400 text-nowrap'>
      <div role='button' class='pointer d-none align-items-center justify-content-center font-size-16 rounded option details py-5 px-10' class:d-flex={!current} aria-label='Play Torrent' title='Play Torrent' use:click={() => { add(infoHash, null, infoHash); toggleDropdown() }}>
        Play
      </div>
      <div role='button' class='pointer d-none align-items-center justify-content-center font-size-16 rounded option details py-5 px-10' class:d-flex={!current} aria-label='Untrack Torrent' title='Untrack Torrent' use:click={() => { untrack(infoHash); toggleDropdown() }}>
        Untrack
      </div>
      <div role='button' class='pointer d-none align-items-center justify-content-center font-size-16 rounded option details py-5 px-10' class:d-flex={resolvedId && $mediaCache[resolvedId]} aria-label='View Media' title='View Media' use:click={() => { viewMedia(); toggleDropdown() }}>
        View Media
      </div>
      <div role='button' class='pointer d-none align-items-center justify-content-center font-size-16 rounded option details py-5 px-10' class:d-flex={!completed && !current && data.progress === 1 && settings.value.torrentPersist} aria-label='Stop Seeding' title='Stop Seeding' use:click={() => { complete(infoHash); toggleDropdown() }}>
        Stop Seeding
      </div>
      <div role='button' class='pointer d-none align-items-center justify-content-center font-size-16 rounded option details py-5 px-10' class:d-flex={!completed && !current && data.progress < 1 && settings.value.torrentPersist} aria-label='Stop Download' title='Stop Download' use:click={() => { unload(infoHash, true); toggleDropdown() }}>
        Stop Download
      </div>
      <div role='button' class='pointer d-none align-items-center justify-content-center font-size-16 rounded option details py-5 px-10' class:d-flex={completed && !data.incomplete && settings.value.seedingLimit > 1 && !disableRescan} aria-label='Start Seeding' title='Start Seeding' use:click={() => { stage(infoHash, null, infoHash); toggleDropdown() }}>
        Start Seeding
      </div>
      <div role='button' class='pointer d-none align-items-center justify-content-center font-size-16 rounded option details py-5 px-10' class:d-flex={completed && data.incomplete && settings.value.seedingLimit > 1 && !disableRescan} aria-label='Continue Downloading' title='Continue Downloading' use:click={() => { stage(infoHash, null, infoHash); toggleDropdown() }}>
        Continue Downloading
      </div>
    </div>
  </div>
</div>
<style>
  .py-3 {
    padding-top: .3rem;
    padding-bottom: .3rem;
  }
  .px-3 {
    padding-left: .3rem;
    padding-right: .3rem;
  }
  .mr-2 {
    margin-right: 0.2rem;
  }
  .current {
    border: .1rem solid var(--quaternary-color) !important;
  }
  .details {
    border: .1rem solid transparent;
  }
  .option:hover {
    background-color: var(--dark-color-light);
    border: .1rem solid var(--highlight-color) !important;
  }
</style>