<script context='module'>
  const defaultLength = 15
  const overflowLength = 1
  const loadableLength = 50
  const fakecards = Array.from({ length: loadableLength }, () => ({ data: new Promise(() => {}) }))
</script>

<script>
  import Card from '@/components/cards/Card.svelte'
  import ErrorCard from '@/components/cards/ErrorCard.svelte'
  import { search } from '@/modules/sections.js'
  import { page } from '@/App.svelte'
  import { click, dragScroll } from '@/modules/click.js'
  import { SUPPORTS } from '@/modules/support.js'
  import { onDestroy, afterUpdate } from 'svelte'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'

  export let lastEpisode = false
  export let opts

  let visibleLength = 0
  const preview = opts.preview
  function deferredLoad (element) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!opts.preview.value) opts.preview.value = opts.load(1, loadableLength, { ...opts.variables })
        observer.unobserve(element)
      }
    }, { threshold: 0 })
    observer.observe(element)
    return { destroy () { observer.unobserve(element) } }
  }

  function _click () {
    $search = { ...opts.variables, load: opts.load, title: opts.title, clearNext: true }
    $page = 'search'
  }

  let activeScroll = false
  function scrolling(duration = 1000) {
    activeScroll = true
    setTimeout(() => activeScroll = false, duration)
  }

  let scrollContainer
  let previewLength = defaultLength
  function scrollCarousel(direction) {
    if (activeScroll) return
    if (direction === 'right' && (scrollContainer.scrollLeft + 2) >= (scrollContainer.scrollWidth - scrollContainer.clientWidth)) {
      scrolling()
      scrollContainer.scrollTo({ left: 0, behavior: 'smooth' })
    } else if (direction === 'left' && scrollContainer.scrollLeft <= 0) {
      visibleLength = loadableLength
      setTimeout(() => {
        scrolling()
        scrollContainer.scrollTo({left: (scrollContainer.scrollWidth - scrollContainer.clientWidth), behavior: 'smooth'})
      })
    } else {
      visibleLength = Math.min((visibleLength || previewLength) + previewLength, loadableLength)
      setTimeout(() => {
        scrolling(500)
        const scrollAmount = scrollContainer.offsetWidth
        scrollContainer.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' })
      })
    }
  }

  function handleScroll() {
    if (scrollContainer && ((scrollContainer.scrollWidth - scrollContainer.clientWidth) - scrollContainer.scrollLeft < 100)) visibleLength = Math.min((visibleLength || previewLength) + overflowLength, loadableLength)
  }

  let timeout
  function handleUpdate() {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      if (!scrollContainer) return
      const cardItem = scrollContainer.querySelector('.small-card-ct, .full-card-ct, .episode-card')
      if (cardItem) previewLength = (Math.floor((scrollContainer.offsetWidth) / (cardItem.offsetWidth)) || defaultLength) + overflowLength
    }, 15)
  }

  let observer = null
  $: {
    if (scrollContainer && !observer) {
      observer = new ResizeObserver(handleUpdate)
      observer.observe(scrollContainer)
      window.addEventListener('resize', handleUpdate)
      scrollContainer.addEventListener('scroll', handleScroll)
    }
  }
  afterUpdate(handleUpdate)
  onDestroy(() => {
    observer?.disconnect()
    observer = null
    window.removeEventListener('resize', handleUpdate)
    scrollContainer.removeEventListener('scroll', handleScroll)
  })
</script>

<span class='d-flex px-20 align-items-end text-decoration-none' class:mv-10={lastEpisode} use:deferredLoad>
  <div class='font-scale-24 font-weight-semi-bold glow text-muted pointer' aria-hidden='true' use:click={_click}>{opts.title}</div>
  <div class='ml-auto pr-5 pl-5 font-size-12 glow text-muted pointer btn d-none align-items-center justify-content-center' class:d-flex={!SUPPORTS.isAndroid} aria-hidden='true' use:click={() => scrollCarousel('left')}><ChevronLeft strokeWidth='3' size='2rem' /></div>
  <div class='pr-5 pl-5 ml-10 font-size-12 glow text-muted pointer btn d-none align-items-center justify-content-center' class:d-flex={!SUPPORTS.isAndroid} aria-hidden='true' use:click={() => scrollCarousel('right')}><ChevronRight strokeWidth='3' size='2rem' /></div>
</span>
<div class='position-relative'>
  <div class='pb-10 w-full d-flex flex-row justify-content-start gallery' use:dragScroll bind:this={scrollContainer}>
    {#each ($preview || fakecards).slice(0, visibleLength || previewLength) as card}
      <Card {card} variables={{...opts.variables, section: true}} />
    {/each}
    {#if $preview?.length}
      <ErrorCard promise={$preview[0].data} />
    {/if}
  </div>
</div>

<style>
  .btn {
    border-radius: 2rem;
  }
  .gallery :global(.small-card-ct:first-child) :global(.absolute-container) {
    left: -45% !important;
  }
  .gallery :global(.small-card-ct:last-child):not(:only-child) :global(.absolute-container) {
    right: -45% !important;
  }

  @media (max-width: 768px) {
    .gallery :global(.small-card-ct:first-child) :global(.absolute-container) {
      left: -35% !important;
    }
    .gallery :global(.small-card-ct:last-child:not(:only-child)) :global(.absolute-container) {
      right: -35% !important;
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .glow:hover {
      color: var(--dm-link-text-color-hover) !important;
    }
  }
  .gallery:after {
    content: '';
    position: absolute;
    right: 0;
    height: 100%;
    width: 8rem;
    background: var(--section-end-gradient);
    pointer-events: none;
  }
  .gallery {
    overflow-x: scroll;
    flex-shrink: 0;
    min-height: 25rem;
    cursor: grab;
  }
  .mv-10 {
    margin-top: -15rem !important;
    z-index: 0 !important;
  }
  .gallery :global(.item.small-card) {
    width: 19rem !important;
  }
  .gallery::-webkit-scrollbar {
    display: none;
  }
</style>