<script>
  import { getContext } from 'svelte'
  import { onMount, onDestroy } from 'svelte'
  import { airingAt, getAiringInfo, formatMap, getKitsuMappings, getMediaMaxEp, statusColorMap } from '@/modules/anime/anime.js'
  import { click } from '@/modules/click.js'
  import SmartImage from '@/components/visual/SmartImage.svelte'
  import AudioLabel from '@/views/ViewAnime/AudioLabel.svelte'
  import { anilistClient, seasons } from '@/modules/anilist.js'
  import { mediaCache } from '@/modules/cache.js'

  /** @type {import('@/modules/al.d.ts').Media} */
  export let data
  export let variables = null
  let _variables = variables

  let media
  $: if (data && !media) media = mediaCache.value[data?.id]
  mediaCache.subscribe((value) => { if (value && (JSON.stringify(value[media?.id]) !== JSON.stringify(media))) media = value[media?.id] })
  $: maxEp = getMediaMaxEp(media)

  const view = getContext('view')
  function viewMedia () {
    if (_variables?.fileEdit) _variables.fileEdit(media)
    else $view = media
  }

  let airingInterval
  let _airingAt = null
  $: airingInfo = getAiringInfo(_airingAt)
  onMount(() => {
    _airingAt = media && _variables?.scheduleList && airingAt(media, _variables)
    if (_variables?.scheduleList) airingInterval = setInterval(() => airingInfo = getAiringInfo(_airingAt), 60_000)
  })
  onDestroy(() => clearTimeout(airingInterval))
</script>

<div class='d-flex px-md-20 py-10 position-relative justify-content-center full-card-ct' use:click={viewMedia}>
  <div class='card load-in m-0 p-0 pointer full-card {airingInfo?.episode.match(/out for/i) ? `airing` : ``}' style:--color={media.coverImage.color || 'var(--tertiary-color)'}>
    <div class='row h-full'>
      <div class='img-col d-inline-block position-relative col-3 col-md-4'>
        <span class='airing-badge rounded-10 font-weight-semi-bold text-light bg-success' class:d-none={!airingInfo?.episode?.match(/out for/i)}>AIRING</span>
        <SmartImage class='cover-img cover-color w-full h-270' color={media.coverImage.color || 'var(--tertiary-color)'} images={[media.coverImage.extraLarge, media.coverImage?.medium, './404_cover.png']}/>
        {#if !_variables?.scheduleList}
          <AudioLabel {media} />
        {/if}
      </div>
      <div class='col h-full card-grid'>
        <div class='px-15 py-10 bg-very-dark'>
          <h5 class='m-0 text-white text-capitalize font-weight-bold title'>
            {#if media.mediaListEntry?.status}
              <div style:--statusColor={statusColorMap[media.mediaListEntry.status]} class='list-status-circle d-inline-flex overflow-hidden mr-5' title={media.mediaListEntry.status} />
            {/if}
            {anilistClient.title(media)}
          </h5>
          <div class='details text-muted m-0 pt-5 text-capitalize d-flex flex-wrap'>
              <span class='badge pl-5 pr-5'>
                {#if media.format}
                  {formatMap[media.format]}
                {/if}
              </span>
            {#if maxEp > 1 || (maxEp !== 1 && ['CURRENT', 'REPEATING', 'PAUSED', 'DROPPED'].includes(media.mediaListEntry?.status) && media.mediaListEntry?.progress)}
                <span class='badge pl-5 pr-5'>
                  {['CURRENT', 'REPEATING', 'PAUSED', 'DROPPED'].includes(media.mediaListEntry?.status) && media.mediaListEntry?.progress ? media.mediaListEntry.progress + ' / ' : ''}{maxEp && maxEp !== 0 && !(media.mediaListEntry?.progress > maxEp) ? maxEp : '?'} Episodes
                </span>
            {:else if media.duration}
                <span class='badge pl-5 pr-5'>
                  {media.duration + ' Minutes'}
                </span>
            {/if}
            {#if media.isAdult}
                <span class='badge pl-5 pr-5'>
                  Rated 18+
                </span>
            {/if}
            {#await ((media.season || media.seasonYear || (media.status === 'NOT_YET_RELEASED')) && media) || getKitsuMappings(media.id) then details}
              {@const attributes = details?.included?.[0]?.attributes}
              {@const seasonYear = details.seasonYear || (attributes?.startDate && new Date(attributes?.startDate).getFullYear()) || (attributes?.createdAt && new Date(attributes?.createdAt).getFullYear())}
              {@const season = (details.season || seasonYear && seasons[Math.floor((((attributes?.startDate && new Date(attributes?.startDate).getMonth()) || (attributes?.createdAt && new Date(attributes?.createdAt).getMonth())) / 12) * 4) % 4])?.toLowerCase()}
              {#if season || seasonYear || (media.status === 'NOT_YET_RELEASED')}
                <span class='badge pl-5 pr-5'>
                  {(season || seasonYear) ? [season, seasonYear].filter(s => s).join(' ') : 'In Production'}
                </span>
              {/if}
              {#if !season && !seasonYear && (media.status === 'NOT_YET_RELEASED')}
                <span class='badge pl-5 pr-5'>
                  Not Released
                </span>
              {/if}
            {/await}
            {#if media.averageScore}
              <span class='badge pl-5 pr-5'>{media.averageScore + '%'} Rating</span>
              {#if media.stats?.scoreDistribution}
                <span class='badge pl-5 pr-5'>{anilistClient.reviews(media)} Reviews</span>
              {/if}
            {/if}
          </div>
          {#if airingInfo}
            <div class='d-flex align-items-center pt-5 text-white'>
              {airingInfo.episode}&nbsp;
              <span class='font-weight-bold {airingInfo.episode.match(/out for/i) ? `text-success` : `text-light`} d-inline'>
                  {airingInfo.time}
              </span>
            </div>
          {/if}
        </div>
        {#if media.description}
          <div class='overflow-y-auto ml-15 pr-15 pb-5 bg-very-dark card-desc pre-wrap'>
            {media.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}
          </div>
        {/if}
        {#if media.genres.length}
          <div class='px-15 pb-5 genres bg-very-dark'>
            {#each media.genres.slice(0, 3) as genre}
              <span class='badge badge-color text-dark mt-5 mr-5 font-weight-bold'>{genre}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .airing::before {
    content: '';
    position: absolute;
    inset: -0.4rem -1rem;
    border-radius: .4rem;
    pointer-events: none;
    animation: airing-pulse 7.5s infinite;
    will-change: box-shadow, opacity;
  }
  @keyframes airing-pulse {
    0%   { box-shadow: 0 0 0 0 var(--success-color); opacity: 0.9; }
    25%  { box-shadow: 0 0 0 .7rem var(--dark-color); opacity: 0.6; }
    40% { box-shadow: 0 0 0 0 var(--dark-color); opacity: 0.4; }
    100% { box-shadow: 0 0 0 0 var(--dark-color); opacity: 0; }
  }
  .airing-badge {
    position: absolute;
    top: -.3rem;
    left: -.6rem;
    font-size: 1rem;
    padding: .35rem .9rem;
    box-shadow: 0 .2rem .5rem hsla(var(--black-color-hsl), 0.2);
  }
  .title {
    display: -webkit-box !important;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.2;
    overflow: hidden
  }
  .pre-wrap {
    white-space: pre-wrap
  }
  .details {
    font-size: 1.3rem;
  }
  .details > span:not(:last-child) {
    margin-right: .2rem;
    margin-bottom: .1rem;
  }
  .card {
    width: 52rem !important;
    height: 27rem !important;
    box-shadow: hsla(var(--dark-color-very-light-hsl), 0.3) 0px 7px 15px, hsla(var(--dark-color-very-light-hsl), 0.05) 0px 4px 4px;
    contain-intrinsic-height: 27rem;
    transition: transform 0.2s ease;
  }
  .card:hover{
    transform: scale(1.03);
  }
  .card-grid {
    display: grid;
    grid-template-rows: auto 1fr auto;
  }
  .badge-color {
    background-color: var(--color) !important;
    border-color: var(--color) !important;
  }
  .list-status-circle {
    background: var(--statusColor);
    height: 1.1rem;
    width: 1.1rem;
    border-radius: 50%;
  }
</style>