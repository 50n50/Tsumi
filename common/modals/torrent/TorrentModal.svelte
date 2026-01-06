<script context='module'>
  import SoftModal from '@/components/modals/SoftModal.svelte'
  import TorrentResults from '@/modals/torrent/components/TorrentResults.svelte'
  import { findInCurrent } from '@/components/MediaHandler.svelte'
  import { page, modal } from '@/modules/navigation.js'

  export function playAnime (media, episode = 1, force = false) {
    episode = Number(episode)
    episode = isNaN(episode) ? 1 : episode
    if (!force && findInCurrent({ media, episode })) {
      page.navigateTo(page.PLAYER)
      return
    }
    modal.open(modal.TORRENT_MENU, { media, episode })
  }
</script>

<script>
  function close () {
    modal.close(modal.TORRENT_MENU)
  }
</script>

<SoftModal class='m-0 w-full wm-1150 h-full rounded bg-very-dark pt-0 mx-20' bind:showModal={$modal[modal.TORRENT_MENU]} {close} id='torrentModal'>
  <TorrentResults search={modal.value[modal.TORRENT_MENU].data} {close} />
</SoftModal>