<script>
  import { page, modal, playPage } from '@/modules/navigation.js'
  import { nowPlaying as media } from '@/components/MediaHandler.svelte'
  import { hasUnreadNotifications } from '@/modals/NotificationsModal.svelte'
  import NavbarLink from '@/components/navigation/NavbarLink.svelte'
  import { Home, Search, Users, CalendarSearch, Settings, Bell, BellDot, ListVideo, History, TvMinimalPlay } from 'lucide-svelte'
</script>

<nav class='navbar z-80 navbar-fixed-bottom d-block d-md-none border-0 bg-dark bt-10'>
  <div class='navbar-menu h-full d-flex flex-row justify-content-center align-items-center m-0 pb-5 animate'>
    <NavbarLink click={() => page.navigateTo(page.HOME)} _page={page.HOME} text='Home' let:active>
      <Home size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
    <NavbarLink click={() => page.navigateTo(page.SEARCH)} _page={page.SEARCH} icon='search' text='Search' let:active>
      <Search size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' stroke-width='2.5' stroke='currentColor' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
    <NavbarLink click={() => page.navigateTo(page.SCHEDULE)} _page={page.SCHEDULE} icon='schedule' text='Schedule' let:active>
      <CalendarSearch size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
    {#if $media?.media || ($playPage && (Object.keys($media).length > 0))}
      {@const currentMedia = $modal[modal.ANIME_DETAILS]?.data}
      {@const wasModal = $modal && modal.length}
      <NavbarLink
        click={() => {
          if ($playPage && (page.value === page.PLAYER) && !wasModal) {
            playPage.set(false)
          }
          if ($playPage) {
            page.navigateTo(page.PLAYER)
          } else if (currentMedia?.id === $media?.media.id && modal.length === 1) {
            modal.close(modal.ANIME_DETAILS)
          } else {
            modal.open(modal.ANIME_DETAILS, $media?.media)
          }
        }}
        rbClick={() => {
          if ($media?.media) {
            if (currentMedia?.id === $media.media.id && modal.length === 1) {
              modal.close(modal.ANIME_DETAILS)
            } else {
              modal.open(modal.ANIME_DETAILS, $media.media)
            }
          }
        }} _page={$playPage ? page.PLAYER : null} icon='queue_music' text={$media?.display ? 'Last Watched' : 'Now Playing'} _modal={modal.ANIME_DETAILS} let:active>
        <svelte:component this={$playPage ? TvMinimalPlay : $media?.display ? History : ListVideo} size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active && (currentMedia?.id === $media?.media?.id) ? 'currentColor' : 'var(--gray-color-very-dim)'} />
      </NavbarLink>
    {/if}
    <NavbarLink click={() => page.navigateTo(page.WATCH_TOGETHER)} _page={page.WATCH_TOGETHER} icon='groups' text='Watch Together' let:active>
      <Users size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
    <NavbarLink click={() => { modal.toggle(modal.NOTIFICATIONS) }} icon='bell' text='Notifications' _modal={modal.NOTIFICATIONS} let:active let:hovering>
      {#if $hasUnreadNotifications &&  $hasUnreadNotifications > 0}
        <BellDot size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded fill-1 notify' strokeWidth='2.5' color='currentColor' style='--fill-button-color: {hovering ? `var(--gray-color-very-dim)` : `var(--notify-color)`}'/>
      {:else}
        <Bell size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={$modal[modal.NOTIFICATIONS] ? 'currentColor' : 'var(--gray-color-very-dim)'}/>
      {/if}
    </NavbarLink>
    <NavbarLink click={() => page.navigateTo(page.SETTINGS)} _page={page.SETTINGS} icon='settings' text='Settings' let:active>
      <Settings size='3.6rem' class='flex-shrink-0 p-5 m-5 rounded' strokeWidth='2.5' color={active ? 'currentColor' : 'var(--gray-color-very-dim)'} />
    </NavbarLink>
  </div>
</nav>

<style>
  .navbar .animate :global(.donate) {
    animation: pink_glow 1s ease-in-out infinite alternate;
    will-change: drop-shadow;
  }
  .navbar .animate :global(.notify) {
    animation: purple_glow 1s ease-in-out infinite alternate, bell_shake 10s infinite;
    will-change: drop-shadow;
  }
  .navbar :global(.fill-1) {
    color: var(--fill-button-color);
    text-shadow: 0 0 1rem var(--fill-button-color);
  }
  .bt-10 {
    border-top: .10rem var(--border-color-sp) solid !important;
  }
</style>
