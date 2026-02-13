<script>
  import { FileQuestion } from 'lucide-svelte'
  export let name = null
  export let icon = null
</script>

<div class='card bg-dark p-15 d-flex mx-0 overflow-hidden mb-10 mt-0 rounded-3' title={name ? `Processing ${name} results..` : ''}>
  <div class='d-flex pl-10 flex-column justify-content-between w-full h-100' style='min-width: 0'>
    <div class='d-flex w-full'>
      <div class='skeloader h-25 w-250 mw-full rounded bg-ske'/>
      <div class='d-flex ml-auto'>
        {#if icon && icon !== 'none'}
          <img class='wh-25' src={(!icon.startsWith('http') ? 'data:image/png;base64,' : '') + icon} alt={name} title={name}>
        {:else if icon === 'none'}
          <FileQuestion size='2.5rem' />
        {/if}
      </div>
    </div>
    <div class='skeloader h-10 w-150 mw-full rounded bg-ske'/>
    <div class='metadata-container d-flex flex-row w-full'>
      <div class='skeloader h-10 w-300 mw-full rounded bg-ske'/>
      <div class='skeloader h-10 w-150 mw-full rounded bg-ske ml-auto secondary-metadata'/>
      </div>
  </div>
</div>

<style>
  /* Behavior for narrow screens (mobile) */
  @media (max-width: 35rem) {
    .metadata-container {
      flex-direction: column  !important;
    }
    .secondary-metadata {
      margin-left: 0 !important;
      margin-top: 1rem;
      justify-content: flex-start !important;
    }
  }
</style>
