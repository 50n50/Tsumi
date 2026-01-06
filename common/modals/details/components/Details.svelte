<script>
  import { Building2, Earth, Adult, FolderKanban, Languages, CalendarRange, MonitorPlay, Type } from 'lucide-svelte'
  import { getKitsuMappings } from '@/modules/anime/anime.js'
  import { seasons } from '@/modules/anilist.js'

  export let media = null
  export let alt = null

  let scrollDetails
  $: if (media && scrollDetails) scrollDetails.scrollLeft = 0

  const countryMap = {
    JP: 'Japan',
    KR: 'South Korea',
    US: 'United States',
    CN: 'China',
    HK: 'Hong Kong',
    TW: 'Taiwan'
  }
  const detailsMap = [
    { property: 'season', label: 'Season', icon: CalendarRange, custom: 'property' },
    { property: 'status', label: 'Status', icon: MonitorPlay },
    { property: 'studios', label: 'Studio', icon: Building2, custom: 'property' },
    { property: 'source', label: 'Source', icon: FolderKanban },
    { property: 'countryOfOrigin', label: 'Country', icon: Earth, custom: 'property' },
    { property: 'isAdult', label: 'Adult', icon: Adult },
    { property: 'english', label: 'English', icon: Type },
    { property: 'romaji', label: 'Romaji', icon: Languages },
    { property: 'native', label: 'Native', icon: '語', custom: 'icon' }
  ]

  let studio
  let seasonal
  function getCustomProperty (property, media) {
    if (property === 'averageScore') {
      return media.averageScore + '%'
    } else if (property === 'season') {
      return seasonal
    } else if (property === 'countryOfOrigin') {
      return countryMap[media.countryOfOrigin]
    } else if (property === 'studios') {
      return studio
    } else {
      return media[property]
    }
  }
  async function getProperty (property, media) {
    if (property === 'episode') {
      return media.nextAiringEpisode?.episode
    } else if (property === 'english' || property === 'romaji' || property === 'native') {
      return media.title[property]
    } else if (property === 'isAdult') {
      return (media.isAdult === true ? 'Rated 18+' : false)
    } else if (property === 'countryOfOrigin') {
      return countryMap[media.countryOfOrigin]
    } else if (property === 'studios') { // has to be manually fetched as studios returned by user lists are broken.
      studio = ((await alt)?.data?.Media || media)?.studios?.nodes?.map(node => node.name)?.[0] // sometimes this can still be wrong, so we just get the first studio in the list and assume that's correct.
      return studio
    } else if (property === 'season') {
      const details = await (((media.season || media.seasonYear || (media.status === 'NOT_YET_RELEASED')) && media) || getKitsuMappings(media.id))
      const attributes = details?.included?.[0]?.attributes
      const seasonYear = details.seasonYear || (attributes?.startDate && new Date(attributes?.startDate).getFullYear()) || (attributes?.createdAt && new Date(attributes?.createdAt).getFullYear())
      const season = (details.season || seasonYear && seasons[Math.floor((((attributes?.startDate && new Date(attributes?.startDate).getMonth()) || (attributes?.createdAt && new Date(attributes?.createdAt).getMonth())) / 12) * 4) % 4])?.toLowerCase()
      seasonal = (season || seasonYear) ? [season, seasonYear].filter(f => f).join(' ') : (media.status === 'NOT_YET_RELEASED') ? 'In Production' : null
      return seasonal
    }
    return media[property]
  }
</script>

<div bind:this={scrollDetails} class='card m-0 px-20 pb-0 pt-10 d-flex flex-row overflow-x-scroll text-capitalize align-items-start bg-dark-light'>
  {#each detailsMap as detail}
    {#await getProperty(detail.property, media) then property}
      {#if property}
        <div class='d-flex flex-row mx-10 py-5 justify-content-center'>
          {#if detail.custom !== 'icon'}
            <svelte:component size='2rem' this={detail.icon} class='mr-10' />
          {:else}
            <div class='mr-10 d-flex align-items-center text-nowrap font-size-12 font-weight-bold line-height-normal'>
              {detail.icon}
            </div>
          {/if}
          <div class='d-flex flex-column justify-content-center text-nowrap'>
            <div class='font-weight-bold select-all line-height-normal'>
              {#if detail.custom === 'property'}
                {getCustomProperty(detail.property, media)}
              {:else}
                {property.toString().replace(/_/g, ' ').toLowerCase()}
              {/if}
            </div>
            <div />
          </div>
        </div>
      {/if}
    {/await}
  {/each}
</div>
