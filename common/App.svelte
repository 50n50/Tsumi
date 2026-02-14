<script context='module'>
  import { IPC } from '@/modules/bridge.js'
  import { writable } from 'simple-store-svelte'
  import { anilistClient } from '@/modules/anilist.js'
  import { page, modal, destroyHistory, enableHistory } from '@/modules/navigation.js'

  export const statusTransition = writable(false)

  export async function handleAnime (detail) {
    IPC.emit('window-show')
    modal.close(modal.ANIME_DETAILS)
    const foundMedia = (await anilistClient.searchIDSingle(!detail.mal ? { id: detail.id } : { idMal: detail.id })).data.Media
    if (foundMedia) modal.open(modal.ANIME_DETAILS, foundMedia)
  }
  IPC.on('open-anime', handleAnime)
  window.addEventListener('open-anime', (event) => handleAnime(event.detail))
  IPC.on('schedule', () => page.navigateTo(page.SCHEDULE))
</script>

<script>
  import Sidebar from '@/components/navigation/Sidebar.svelte'
  import Router from '@/routes/Router.svelte'
  import DetailsModal from '@/modals/details/DetailsModal.svelte'
  import ExtensionModal from '@/modals/extension/ExtensionModal.svelte'
  import DefaultLoadingModal from '@/modals/extension/DefaultLoadingModal.svelte'
  import ServerSelectorModal from '@/modals/extension/ServerSelectorModal.svelte'
  import Menubar from '@/components/Menubar.svelte'
  import Profiles from '@/components/Profiles.svelte'
  import NotificationsModal from '@/modals/NotificationsModal.svelte'
  import MinimizeModal from '@/modals/MinimizeModal.svelte'
  import Navbar from '@/components/navigation/Navbar.svelte'
  import Status from '@/components/Status.svelte'
  import { status } from '@/modules/networking.js'
  import { Toaster } from 'svelte-sonner'
  import { onMount, onDestroy } from 'svelte'

  IPC.emit('main-ready')

  let currentStatus = status.value
  let transitionTimer
  const unsubscribeMonitor = status.subscribe(value => {
    if (value !== currentStatus) {
      clearTimeout(transitionTimer)
      statusTransition.set(true)
      transitionTimer = setTimeout(() => statusTransition.set(false), 2_500)
      transitionTimer.unref?.()
      currentStatus = value
    }
  })

  let isFullscreen = !!document.fullscreenElement

  function updateFullscreen() {
    isFullscreen = !!document.fullscreenElement
  }

  onMount(() => {
    enableHistory()
    document.addEventListener('fullscreenchange', updateFullscreen)
  })
  onDestroy(() => {
    destroyHistory()
    unsubscribeMonitor()
    clearTimeout(transitionTimer)
    document.removeEventListener('fullscreenchange', updateFullscreen)
  })
</script>

<MinimizeModal />
<div class='page-wrapper with-transitions bg-dark position-relative pl-safe-area' data-sidebar-type='overlayed-all'>
  <Status />
  <Menubar />
  <Sidebar />
  <Navbar />
  <div class='content-wrapper h-full' class:status-transition={$statusTransition}>
    <Toaster visibleToasts={2} position='top-right' theme='dark' richColors duration={10_000} closeButton toastOptions={{class: `${$page === page.SETTINGS ? 'mt-70 mt-lg-0' : ''} ${isFullscreen && (!$modal || !modal.length) ? 'd-none' : ''}`}} />
    <DetailsModal />
    <ExtensionModal />
    <DefaultLoadingModal />
    <ServerSelectorModal />
    <NotificationsModal />
    <Profiles />
    <Router bind:statusTransition={$statusTransition} />
  </div>
</div>

<style>
  .page-wrapper {
    height: calc(100% - var(--navbar-height)) !important;
  }
  .content-wrapper {
    will-change: width;
    white-space: pre-line;
    top: 0 !important;
  }
  .page-wrapper > .content-wrapper {
    margin-left: var(--sidebar-minimised) !important;
    width: calc(100% - var(--sidebar-minimised)) !important;
    height: calc(100% - var(--wrapper-offset, 0rem)) !important;
  }
</style>