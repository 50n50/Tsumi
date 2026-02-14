<script context='module'>
  import { modal } from '@/modules/navigation.js'
  import { click } from '@/modules/click.js'
  import { Server, ArrowLeft } from 'lucide-svelte'
</script>

<script>
  import SoftModal from '@/components/modals/SoftModal.svelte'

  $: data = $modal[modal.SERVER_SELECTOR]?.data
  $: servers = data?.servers || []
  $: onSelect = data?.onSelect
  $: onBack = data?.onBack

  function close () {
    modal.close(modal.SERVER_SELECTOR)
  }

  function pickServer (index) {
    close()
    onSelect?.(index)
  }

  function goBack () {
    close()
    onBack?.()
  }
</script>

<SoftModal class='m-0 wm-500 rounded bg-very-dark p-30' bind:showModal={$modal[modal.SERVER_SELECTOR]} {close} id={modal.SERVER_SELECTOR}>
  <div class='d-flex align-items-center mb-20'>
    <button type='button' class='btn btn-square bg-dark-very-light d-flex align-items-center justify-content-center rounded-2 flex-shrink-0 mr-15' use:click={goBack}>
      <ArrowLeft size='1.5rem' />
    </button>
    <h5 class='mb-0 font-weight-bold text-white'>Select Server</h5>
  </div>
  <div class='server-list d-flex flex-column gap-10'>
    {#each servers as server, i}
      <button type='button' class='server-item bg-dark-light rounded-2 p-15 border-0 pointer w-full d-flex align-items-center' use:click={() => pickServer(i)}>
        <Server size='1.8rem' class='text-primary mr-15 flex-shrink-0' />
        <span class='font-weight-semi-bold text-white'>{server.title || `Server ${i + 1}`}</span>
      </button>
    {/each}
  </div>
</SoftModal>

<style>
  .gap-10 {
    gap: 1rem;
  }
  .server-item {
    transition: background 0.15s ease;
  }
  .server-item:hover {
    background: var(--dark-color) !important;
  }
</style>
