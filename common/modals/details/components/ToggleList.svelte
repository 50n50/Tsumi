<script>
  import { settings } from '@/modules/settings.js'
  import { click } from '@/modules/click.js'
  import { onDestroy, afterUpdate } from 'svelte'
  import ToggleTitle from '@/modals/details/components/ToggleTitle.svelte'
  import ToggleFooter from '@/modals/details/components/ToggleFooter.svelte'

  export let title
  export let promise
  export let list

  let showMore = false
  function toggleList() {
    showMore = !showMore
  }

  let container = null
  let previewLength = 4
  function updateRowLength() {
    if (!container || !settings.value.toggleList) return
    const firstItem = container.querySelector('.small-card')
    if (firstItem) previewLength = Math.floor((container.offsetWidth) / (firstItem.offsetWidth)) || 1
  }

  function updateRowMarkers() {
    if (!container) return
    const cards = Array.from(container.querySelectorAll('.small-card'))
    cards.forEach(card => card.classList.remove('first-in-row', 'last-in-row'))
    if (!settings.value.toggleList) {
      if (cards.length > 0) {
        cards[0].classList.add('first-in-row')
        cards[cards.length > 1 ? cards.length - 2 : 0].classList.add('last-in-row')
      }
    } else {
      const rows = new Map()
      cards.forEach(card => {
        const top = Math.round(card.getBoundingClientRect().top)
        if (!rows.has(top)) rows.set(top, [])
        rows.get(top).push(card)
      })
      rows.forEach(cardsInRow => {
        if (cardsInRow.length > 0) {
          cardsInRow[0].classList.add('first-in-row')
          cardsInRow[cardsInRow.length - 1].classList.add('last-in-row')
        }
      })
    }
  }

  function handleUpdate() {
    updateRowLength()
    updateRowMarkers()
  }

  let observer = null
  $: {
    if (container && !observer) {
      observer = new ResizeObserver(handleUpdate)
      observer.observe(container)
      window.addEventListener('resize', handleUpdate)
    }
  }
  afterUpdate(handleUpdate)
  onDestroy(() => {
    observer?.disconnect()
    observer = null
    window.removeEventListener('resize', handleUpdate)
  })
</script>

{#if list?.length}
  {@const canToggle = settings.value.toggleList && list.length > previewLength}
  <span class='d-flex align-items-end mt-20' aria-hidden='true' tabindex='-1' class:pointer={canToggle} class:not-reactive={!canToggle} use:click={toggleList}>
    <ToggleTitle title={title} class={canToggle ? `more` : ``}/>
  </span>
  <div class='pt-10 text-capitalize d-flex gallery'
       class:justify-content-center={list.length <= 2 || settings.value.toggleList}
       class:justify-content-start={list.length > 2 && !settings.value.toggleList}
       class:scroll={!settings.value.toggleList && list.length > 2}
       class:flex-row={!settings.value.toggleList}
       class:flex-wrap={settings.value.toggleList}
       bind:this={container}>
    {#each !settings.value.toggleList ? list : (showMore ? list : list.slice(0, previewLength)) as item}
      <slot {item} {promise} />
    {/each}
  </div>
  <ToggleFooter {showMore} {toggleList} size={settings.value.toggleList && list.length} rowSize={previewLength} />
{/if}

<style>
  .scroll {
    overflow-x: scroll;
    flex-shrink: 0;
    scroll-behavior: smooth;
  }
  .scroll::-webkit-scrollbar {
    display: none;
  }

  .gallery :global(.first-in-row .small-card-ct .absolute-container) {
    left: -48% !important;
  }
  .gallery :global(.last-in-row .small-card-ct .absolute-container) {
    right: -48% !important;
  }
  .gallery :global(.item.small-card) {
    width: 19rem !important;
  }
  .gallery :global(.small-card-ct) {
    height: 100% !important;
  }
</style>