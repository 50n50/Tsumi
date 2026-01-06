<script>
  import { getContext } from 'svelte'
  import { TABS } from '@/components/tabs/Tabs.svelte'
  import { click } from '@/modules/click.js'

  const tab = {}
  export let name = ''
  export let action = null
  export let sidebar = false
  export let substitute = false
  const { registerTab, selectTab, selectedTab } = getContext(TABS)

  registerTab(tab)
</script>

<div class='tab-label pointer mx-auto pl-lg-20 w-lg-full {sidebar ? `d-none d-lg-block` : ``} {substitute ? `d-sm-h-block d-sm-none` : ``}' title={name} use:click={() => (action ?? (() => selectTab(tab)))()}>
  <span class='d-flex align-items-center rounded'>
    <slot active={$selectedTab === tab}/>
  </span>
</div>

<style>
  .tab-label > span {
    color: var(--highlight-color);
    border-radius: 0.3rem;
  }
  .tab-label > span {
    color: var(--highlight-color);
    transition: background .8s cubic-bezier(0.25, 0.8, 0.25, 1), color .8s cubic-bezier(0.25, 0.8, 0.25, 1);
  }
  .tab-label:active > span {
    background: var(--highlight-color);
    color: var(--dark-color);
  }
  @media (hover: hover) and (pointer: fine) {
    .tab-label:hover > span {
      background: var(--highlight-color);
      color: var(--dark-color);
    }
  }
  .tab-label:focus-visible > span {
    background: var(--highlight-color);
    color: var(--dark-color);
  }
  .tab-label:focus-visible {
    outline: none !important;
    box-shadow: none !important;
  }
  .tab-label {
    font-size: 1.4rem;
    padding: 0.75rem;
    height: 5.5rem;
    min-width: 0;
  }
</style>