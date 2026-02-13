<script>
  import HomePage from '@/routes/home/HomePage.svelte'
  import MediaHandler, { nowPlaying as media } from '@/components/MediaHandler.svelte'
  import SettingsPage from '@/routes/settings/SettingsPage.svelte'
  import WatchTogetherPage from '@/routes/w2g/WatchTogetherPage.svelte'
  import SchedulePage from '@/routes/SchedulePage.svelte'
  import Miniplayer, { isMobile, isSuperSmall } from '@/components/Miniplayer.svelte'
  import SearchPage from '@/routes/search/SearchPage.svelte'
  import { cache, caches } from '@/modules/cache.js'
  import { search, key } from '@/modules/sections.js'
  import { page, modal, playPage } from '@/modules/navigation.js'

  export let statusTransition = false

  export let miniplayerPadding = getPadding()
  export let miniplayerActive = false
  setInterval(() => (miniplayerPadding = getPadding()), 500)
  function getPadding() {
    const miniplayerTop = cache.getEntry(caches.GENERAL, 'posMiniplayer')?.includes('top')
    let pixelPadding
    if ($isMobile) pixelPadding = miniplayerTop ? 150 : 220
    else pixelPadding = (parseFloat(cache.getEntry(caches.GENERAL, 'widthMiniplayer')) || ($isSuperSmall ? 0.25 : 0.15)) * window.innerWidth * (11 / 16)
    return (miniplayerTop ? 'padding-top: ' : 'padding-bottom: ') + `${pixelPadding}px !important`
  }

  $: miniplayerActive = !($playPage || !$media || !Object.keys($media).length || $media?.display)
  $: visible = !$modal[modal.EXTENSION_MENU] && !$modal[modal.NOTIFICATIONS] && !$modal[modal.PROFILE] && !$modal[modal.MINIMIZE_PROMPT] && !$modal[modal.TRAILER] && !$playPage && !$media?.display
  $: miniplayer = ($media && (Object.keys($media).length > 0)) && (($page !== page.PLAYER && visible) || ($modal[modal.ANIME_DETAILS] && visible))
</script>
<div class='w-full h-full position-absolute overflow-hidden' class:invisible={!($media && (Object.keys($media).length > 0)) || ($playPage && $modal[modal.ANIME_DETAILS]) || (!visible && ($page !== page.PLAYER))}>
  <Miniplayer active={miniplayer} class='bg-dark-light rounded-10 z-100 miniplayer-border {($page === page.PLAYER && !$modal[modal.ANIME_DETAILS]) ? `h-full` : ``}' padding='2rem' >
    <MediaHandler {miniplayer} />
  </Miniplayer>
</div>

{#if $page === page.SETTINGS}
  <SettingsPage bind:statusTransition miniplayerPadding={miniplayerActive ? miniplayerPadding : ''} />
{:else if $page === page.HOME}
  <HomePage />
{:else if $page === page.SEARCH}
  <SearchPage search={search} key={key}/>
{:else if $page === page.SCHEDULE}
  <SchedulePage />
{:else if $page === page.WATCH_TOGETHER}
  <WatchTogetherPage />
{/if}