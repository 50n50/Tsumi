<script>
  import { click } from '@/modules/click.js'
  import { ChevronUp, ChevronDown } from 'lucide-svelte'
  export let size = 0
  export let rowSize = 4
  export let showMore = false
  export let toggleList
</script>

{#if size > rowSize}
  <div class='d-flex justify-content-center mb-30'>
    <hr class='w-full' />
    <button type='button' class='btn btn-square h-40 w-40 rounded-circle border border-light bg-dark-light position-absolute d-flex align-items-center justify-content-center pointer' title={showMore ? 'Show Less' : 'Show More'}  use:click={toggleList}>
      <svelte:component this={ showMore ? ChevronUp : ChevronDown } size='2.2rem' style='margin-right: .05rem' strokeWidth='3' />
    </button>
  </div>
{/if}

<style>
  .btn {
    margin-top: -1rem;
  }
</style>