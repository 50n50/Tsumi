<script>
  import SearchBar, { searchCleanup } from '@/routes/search/components/SearchBar.svelte'
  import Card from '@/components/cards/Card.svelte'
  import { hasNextPage } from '@/modules/sections.js'
  import { status } from '@/modules/networking.js'
  import { debounce } from '@/modules/util.js'
  import { onDestroy, onMount } from 'svelte'
  import { writable } from 'simple-store-svelte'
  import SectionsManager from '@/modules/sections.js'
  import ErrorCard from '@/components/cards/ErrorCard.svelte'

  const items = writable([])
  export let key
  export let search
  export let clearNow = writable(false)
  search?.subscribe((value) => $clearNow = value?.clearNow)

  let page = 0
  items.value = []
  let container = null
  let observer = null

  function updateRowMarkers() {
    if (!container) return
    const cards = container.querySelectorAll('.grid-card')
    let currentRow = []
    let prevTop = null

    cards.forEach(card => card.classList.remove('first-in-row', 'last-in-row'))
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect()
      if (rect.top !== prevTop && currentRow.length > 0) {
        currentRow[currentRow.length - 1].classList.add('last-in-row')
        currentRow = []
      }

      if (rect.top !== prevTop) {
        card.classList.add('first-in-row')
        currentRow.push(card)
      } else currentRow.push(card)

      prevTop = rect.top
      if (index === cards.length - 1 && currentRow.length > 0) currentRow[currentRow.length - 1].classList.add('last-in-row')
    })
  }

  function loadSearchData () {
    const load = $search.load || SectionsManager.createFallbackLoad()
    const nextData = load(++page, undefined, searchCleanup($search))
    $items = [...$items, ...nextData]
    requestAnimationFrame(updateRowMarkers)
    return nextData[nextData.length - 1].data
  }
  const update = debounce((event) => {
    if (!event.target.classList.contains('no-bubbles')) {
      $key = {}
    }
  }, 500)

  $: loadTillFull($key)

  let canScroll = true
  async function loadTillFull (_key) {
    if (!container) return
    const cachedKey = $key
    canScroll = false
    page = 0
    items.value = []
    hasNextPage.value = true
    await loadSearchData()
    while ($hasNextPage && container && cachedKey === $key && container.scrollTop + container.clientHeight > container.scrollHeight - 800) {
      canScroll = false
      await loadSearchData()
    }
    canScroll = true
  }

  async function infiniteScroll (_container) {
    const cachedKey = $key
    const container = _container?.currentTarget || _container
    if (container && canScroll && $hasNextPage && container.scrollTop + container.clientHeight > container.scrollHeight - 800) {
      canScroll = false
      await loadSearchData()
      while ($hasNextPage && container && cachedKey === $key && container.scrollTop + container.clientHeight > container.scrollHeight - 800) {
        canScroll = false
        await loadSearchData()
      }
      canScroll = true
    }
  }

  onDestroy(() => {
    observer?.disconnect()
    window.removeEventListener('resize', updateRowMarkers)
    if ($search.disableSearch) $search = { format: [], format_not: [], status: [], status_not: [] }
  })

  onMount(() => {
    if (container) {
      observer = new ResizeObserver(updateRowMarkers)
      observer.observe(container)
    }
    window.addEventListener('resize', updateRowMarkers)
    loadTillFull()
  })
</script>

<div class='bg-dark h-full w-full overflow-y-scroll d-flex flex-wrap flex-row root overflow-x-hidden justify-content-center align-content-start' class:pt-safe-area={!$search.fileEdit && !$status.match(/offline/i)} class:bg-very-dark={$search.fileEdit} bind:this={container} on:scroll={infiniteScroll} on:resize={updateRowMarkers}>
  <SearchBar bind:search={$search} clearNow={$clearNow} on:input={update} />
  <div class='w-full d-grid d-md-flex flex-wrap flex-row px-40 justify-content-center align-content-start'>
    {#key $key}
      {#each $items as card}
        <div class='grid-card'><Card {card} variables={{...$search}} /></div>
      {/each}
      {#if $items?.length}
        <ErrorCard promise={$items[0].data} />
      {/if}
    {/key}
  </div>
</div>

<style>
  .d-grid:has(.item.small-card) {
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)) !important;
  }
  .d-grid:has(.card.full-card) {
    grid-template-columns: repeat(auto-fill, minmax(52rem, 1fr)) !important;
  }
  .d-grid {
    grid-template-columns: repeat(auto-fill, minmax(36rem, 1fr));
  }

  .d-grid :global(.first-in-row .small-card-ct  .absolute-container) {
    left: -50% !important;
  }
  .d-grid :global(.last-in-row .small-card-ct .absolute-container) {
    right: -50% !important;
  }

  .d-grid :global(.item.small-card) {
    max-width: 19rem !important;
  }

  @media (min-width: 769px) {
    .d-grid :global(.item.small-card) {
      width: 19rem !important;
    }
  }
</style>