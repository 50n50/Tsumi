<script>
  import { click } from '@/modules/click.js'
  import ConfirmButton from '@/components/inputs/ConfirmButton.svelte'
  import { manager } from '@/modules/extension.js'
  import { TriangleAlert, FileQuestion, Trash2, CircleX, Plus, Star, SquarePlus, GripVertical, Crown, X } from 'lucide-svelte'

  export let settings

  $: pendingSource = false
  $: failedSource = null
  $: allExtensions = Object.entries(settings.extensions || {}).map(([key, config]) => ({
    key,
    url: config.url,
    enabled: config.enabled,
    manifest: config.manifest
  }))

  $: defaultExt = settings.defaultExtension ? allExtensions.find(e => e.key === settings.defaultExtension) : null
  $: otherExtensions = allExtensions
    .filter(e => e.key !== settings.defaultExtension)
    .sort((a, b) => {
      if (a.key === settings.starredExtension && b.key !== settings.starredExtension) return -1
      if (b.key === settings.starredExtension && a.key !== settings.starredExtension) return 1
      return 0
    })

  let sourceUrl = ''
  let showAddDialog = false
  let dragOverDefault = false

  async function addSource () {
    if (!sourceUrl?.length || pendingSource) return
    pendingSource = true
    failedSource = null
    try {
      await manager.addExtension(sourceUrl)
      sourceUrl = ''
      showAddDialog = false
    } catch (error) {
      failedSource = error.message || 'Failed to add extension'
    }
    pendingSource = false
  }

  async function removeSource (key) {
    if (pendingSource) return
    pendingSource = true
    if (settings.defaultExtension === key) manager.unsetDefault()
    if (settings.starredExtension === key) manager.unsetStar()
    await manager.removeExtension(key)
    pendingSource = false
  }

  function toggleStar (key) {
    if (settings.starredExtension === key) {
      manager.unsetStar()
    } else {
      manager.setStar(key)
    }
  }

  function handleDragStart (e, key) {
    e.dataTransfer.setData('text/plain', key)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver (e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverDefault = true
  }

  function handleDragLeave () {
    dragOverDefault = false
  }

  function handleDrop (e) {
    e.preventDefault()
    dragOverDefault = false
    const key = e.dataTransfer.getData('text/plain')
    if (key && allExtensions.some(ext => ext.key === key)) {
      manager.setDefault(key)
    }
  }
</script>

<div class='wm-1200 d-flex align-items-center mb-20'>
  <h4 class='mb-0 font-weight-bold'>Extensions</h4>
  <button type='button' class='btn btn-primary d-flex align-items-center justify-content-center rounded-2 ml-auto px-15 h-36 font-scale-16' use:click={() => { showAddDialog = !showAddDialog; failedSource = null }}>
    <Plus size='1.6rem' class='mr-5' />
    <span>Add Extension</span>
  </button>
</div>

{#if showAddDialog}
  <div class='add-overlay position-fixed top-0 left-0 w-full h-full z-50 d-flex align-items-center justify-content-center' on:pointerdown|self={() => { showAddDialog = false }}>
    <div class='add-popup bg-very-dark rounded-3 p-20 w-500'>
      <div class='d-flex align-items-center mb-15'>
        <h5 class='mb-0 font-weight-bold'>Add Extension</h5>
        <button type='button' class='btn btn-square bg-transparent shadow-none border-0 ml-auto p-0' use:click={() => { showAddDialog = false }}>
          <CircleX size='1.8rem' />
        </button>
      </div>
      <div class='alert bg-warning border-warning-dim text-warning-very-dim p-10 pl-15 mb-10 d-flex'>
        <TriangleAlert size='1.8rem' />
        <span class='ml-10'>Extensions are sandboxed and should be safe, but avoid adding <u>unknown</u> or <u>untrusted</u> sources.</span>
      </div>
      {#if failedSource}
        <div class='alert bg-error border-error-light p-10 pl-15 mb-10 d-flex'>
          <CircleX size='1.8rem' />
          <span class='ml-10'>{failedSource}</span>
        </div>
      {/if}
      <div class='input-group'>
        <input placeholder='Extension manifest URL' type='url' class='form-control bg-dark-light mw-full rounded-2 h-36 border text-truncate long-input' disabled={pendingSource} class:cursor-wait={pendingSource} bind:value={sourceUrl} on:keydown={(e) => { if (e.key === 'Enter') addSource() }} />
        <button class='ml-10 btn btn-primary d-flex align-items-center justify-content-center rounded-2 w-100 h-36 font-scale-16' disabled={pendingSource || !sourceUrl?.length} class:cursor-wait={pendingSource} type='button' use:click={() => addSource()}>
          <SquarePlus class='mr-5' size='1.6rem' /><span>Add</span>
        </button>
      </div>

    </div>
  </div>
{/if}

<div class='wm-1200 w-full'>
  {#if !allExtensions.length && !showAddDialog}
    <div class='card m-0 p-15 mb-10 solid-border bg-error'>
      <div class='d-flex'>
        <TriangleAlert size='4.3rem' />
        <div class='ml-10 mb-5 mb-md-0'>
          <div class='font-size-18 font-weight-bold'>No Extensions Found</div>
          <div class='text-muted pre-wrap'>Click the <u>Add Extension</u> button above to get started.</div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Default Extension Section -->
    <div class='mb-20'>
      <div class='d-flex align-items-center mb-5'>
        <Crown size='1.6rem' class='mr-5' style='color: var(--primary-color)' />
        <span class='font-weight-bold font-scale-16'>Default Extension</span>
      </div>
      <div class='text-muted font-scale-14 mb-10'>Drag an extension here to set it as default. The default extension is used automatically — Tsumi will pick the best match and start playing without manual selection.</div>

      {#if defaultExt}
        <div class='card m-0 p-15 mb-10 bg-dark-light border position-relative default-card' class:extension-disabled={!defaultExt.enabled} role='region' on:dragover={handleDragOver} on:dragleave={handleDragLeave} on:drop={handleDrop}>
          <div class='d-flex'>
            {#if defaultExt.manifest?.iconUrl}
              <img class='w-43 h-43 rounded' src={defaultExt.manifest.iconUrl} alt={defaultExt.manifest.sourceName} title={defaultExt.manifest.sourceName} />
            {:else}
              <FileQuestion size='4.3rem' />
            {/if}
            <div class='ml-10 mb-5 mb-md-0 overflow-hidden'>
              <div class='font-size-18 font-weight-bold text-truncate'>{defaultExt.manifest?.sourceName || defaultExt.key}</div>
              {#if defaultExt.manifest?.language}<div class='text-muted pre-wrap'>{defaultExt.manifest.language}</div>{/if}
              <div class='text-muted font-scale-12 text-truncate'>{defaultExt.url}</div>
            </div>
            <div class='d-flex align-items-center ml-auto gap-10'>
              <button type='button' class='btn btn-square d-flex align-items-center justify-content-center bg-transparent shadow-none border-0 p-0' use:click={() => manager.unsetDefault()} title='Remove as Default'>
                <X size='1.8rem' color='var(--gray-color-very-dim)' />
              </button>
            </div>
          </div>
          <div class='d-flex flex-wrap align-items-end'>
            {#if defaultExt.manifest?.version}<span class='badge border-0 bg-light pl-10 pr-10 mt-10 font-scale-16'>{defaultExt.manifest.version}</span>{/if}
            {#if defaultExt.manifest?.streamType}<span class='badge border-0 bg-light pl-10 pr-10 ml-10 mt-10 font-scale-16'>{defaultExt.manifest.streamType}</span>{/if}
          </div>
        </div>
      {:else}
        <div class='drop-zone rounded-2 p-20 d-flex align-items-center justify-content-center mb-10'
          class:drop-zone-active={dragOverDefault}
          role='region'
          on:dragover={handleDragOver}
          on:dragleave={handleDragLeave}
          on:drop={handleDrop}>
          <span class='text-muted font-scale-14'>Drag an extension here to set it as default</span>
        </div>
      {/if}
    </div>

    <!-- Extensions List -->
    <div class='d-flex align-items-center mb-10'>
      <span class='font-weight-bold font-scale-16'>Extensions</span>
    </div>
    {#each otherExtensions as ext}
      {@const isStarred = settings.starredExtension === ext.key}
      <div class='card m-0 p-15 mb-10 bg-dark-light border position-relative' class:extension-disabled={!ext.enabled} style='border-color: {isStarred ? "var(--warning-color)" : "var(--dark-color-light)"} !important' draggable='true' role='listitem' on:dragstart={(e) => handleDragStart(e, ext.key)}>
        <div class='d-flex'>
          <div class='d-flex align-items-center mr-10 drag-handle' title='Drag to set as default'>
            <GripVertical size='1.6rem' color='var(--gray-color-very-dim)' />
          </div>
          {#if ext.manifest?.iconUrl}
            <img class='w-43 h-43 rounded' src={ext.manifest.iconUrl} alt={ext.manifest.sourceName} title={ext.manifest.sourceName} />
          {:else}
            <FileQuestion size='4.3rem' />
          {/if}
          <div class='ml-10 mb-5 mb-md-0 overflow-hidden'>
            <div class='font-size-18 font-weight-bold text-truncate'>{ext.manifest?.sourceName || ext.key}</div>
            {#if ext.manifest?.language}<div class='text-muted pre-wrap'>{ext.manifest.language}</div>{/if}
            <div class='text-muted font-scale-12 text-truncate'>{ext.url}</div>
          </div>
          <div class='d-flex align-items-center ml-auto gap-10'>
            <button type='button' class='btn btn-square d-flex align-items-center justify-content-center bg-transparent shadow-none border-0 p-0' use:click={() => toggleStar(ext.key)} title={isStarred ? 'Unstar' : 'Star — always show at the top of search results'}>
              <Star size='1.8rem' fill={isStarred ? 'var(--warning-color)' : 'none'} color={isStarred ? 'var(--warning-color)' : 'var(--gray-color-very-dim)'} />
            </button>
            <ConfirmButton click={() => removeSource(ext.key)} title='Delete Extension' class='btn btn-square d-flex align-items-center justify-content-center bg-transparent shadow-none border-0 {pendingSource ? "cursor-wait" : ""} text-danger' disabled={pendingSource} primaryClass='' confirmText='' cancelText='' confirmClass='btn-square text-success w-auto' cancelClass='ml-10 text-muted w-auto' actionClass='d-inline-flex flex-row-reverse'>
              <Trash2 size='1.8rem' />
            </ConfirmButton>
            {#if settings.extensions?.[ext.key]}
              <div class='custom-switch'>
                <input type='checkbox' id={`extension-${ext.key}`} bind:checked={settings.extensions[ext.key].enabled} />
                <label for={`extension-${ext.key}`}><br/></label>
              </div>
            {/if}
          </div>
        </div>
        <div class='d-flex flex-wrap align-items-end'>
          {#if ext.manifest?.version}<span class='badge border-0 bg-light pl-10 pr-10 mt-10 font-scale-16'>{ext.manifest.version}</span>{/if}
          {#if ext.manifest?.streamType}<span class='badge border-0 bg-light pl-10 pr-10 ml-10 mt-10 font-scale-16'>{ext.manifest.streamType}</span>{/if}
          {#if ext.manifest?.quality}<span class='badge border-0 bg-light pl-10 pr-10 ml-10 mt-10 font-scale-16'>{ext.manifest.quality}</span>{/if}
          {#if ext.manifest?.type}<span class='badge border-0 bg-light pl-10 pr-10 ml-10 mt-10 font-scale-16'>{ext.manifest.type}</span>{/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .w-43 {
    width: 4.3rem;
  }
  .h-43 {
    height: 4.3rem;
  }
  .h-36 {
    height: 3.6rem;
  }
  .px-15 {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
  .solid-border {
    border: .1rem solid;
  }
  .gap-10 {
    gap: 1rem;
  }
  .alert {
    border: 0;
    border-left: .8rem solid;
    border-radius: .3rem;
  }
  .extension-disabled {
    opacity: .4;
  }
  .w-100 {
    width: 10rem;
  }
  .w-500 {
    width: 50rem;
    max-width: 90vw;
  }
  .add-overlay {
    background: rgba(0, 0, 0, 0.7);
    animation: overlayFadeIn 0.2s ease-in-out;
  }
  .add-popup {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: popupFadeIn 0.2s ease-in-out;
  }
  .drop-zone {
    border: 2px dashed var(--gray-color-very-dim);
    min-height: 6rem;
    transition: border-color 0.2s, background-color 0.2s;
  }
  .drop-zone-active {
    border-color: var(--primary-color);
    background-color: hsla(var(--primary-color-dim-hsl), 0.1);
  }
  .default-card {
    border-color: var(--primary-color) !important;
  }
  .drag-handle {
    cursor: grab;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  @keyframes overlayFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes popupFadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
</style>