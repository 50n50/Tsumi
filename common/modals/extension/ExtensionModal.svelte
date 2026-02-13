<script context='module'>
  import SoftModal from '@/components/modals/SoftModal.svelte'
  import ExtensionResults from '@/modals/extension/components/ExtensionResults.svelte'
  import { page, modal } from '@/modules/navigation.js'

  export function playAnime (media, episode = 1, force = false) {
    episode = Number(episode)
    episode = isNaN(episode) ? 1 : episode
    modal.open(modal.EXTENSION_MENU, { media, episode })
  }
</script>

<script>
  function close () {
    modal.close(modal.EXTENSION_MENU)
  }
</script>

<SoftModal class='m-0 w-full wm-1150 h-full rounded bg-very-dark pt-0 mx-20' bind:showModal={$modal[modal.EXTENSION_MENU]} {close} id={modal.EXTENSION_MENU}>
  <ExtensionResults search={modal.value[modal.EXTENSION_MENU].data} {close} />
</SoftModal>