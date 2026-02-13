<script context='module'>
  import { click } from '@/modules/click.js'
  import { writable } from 'simple-store-svelte'
  import { version } from '@/routes/settings/SettingsPage.svelte'
  import { BadgeAlert, ExternalLink } from 'lucide-svelte'
  import { SUPPORTS } from '@/modules/support.js'
  import ChangelogSk from '@/components/skeletons/ChangelogSk.svelte'
  import SoftModal from '@/components/modals/SoftModal.svelte'
  import Changelog, { changeLog, latestVersion } from '@/routes/settings/components/Changelog.svelte'
  import { settings } from '@/modules/settings.js'
  import { page, modal } from '@/modules/navigation.js'
  import { createDeferred } from '@/modules/util.js'
  import { IPC } from '@/modules/bridge.js'
  import { toast } from 'svelte-sonner'

  export const updateState = writable('up-to-date')
  const sanitizeVersion = (version) => ((version || '').match(/[\d.]+/g)?.join('') || '')
  async function getChangelog(updateVersion) {
    const changelog = await changeLog
    if (!changelog?.length) return null
    const updateIndex = changelog.findIndex(entry => sanitizeVersion(entry.version) === sanitizeVersion(updateVersion))
    if (updateIndex === -1) return { entry: changelog[0], previousVersion: null }
    return {
      entry: changelog[updateIndex],
      previousVersion: changelog[updateIndex + 1]?.version || null
    }
  }

  if (!SUPPORTS.isAndroid) {
    IPC.on('update-available', () => {
      if (updateState.value !== 'ready') updateState.value = 'downloading'
    })
  }

  const updateVersion = writable()
  IPC.on(SUPPORTS.isAndroid ? 'update-available' : 'update-downloaded', (version) => {
    if (updateState.value !== 'ignored' && latestVersion === version && updateVersion.value !== version && (!document.fullscreenElement || page.value !== page.PLAYER)) {
      updateVersion.set(version)
      updateState.value = 'ready'
      if (settings.value.systemNotify || SUPPORTS.isAndroid) {
        IPC.emit('notification', {
          title: 'Update Available!',
          message: `An update to v${version} ${SUPPORTS.isAndroid ? 'is available for download and installation' : 'has been downloaded and is ready for installation'}.`,
          button: [{ text: 'Update Now', activation: 'shiru://update/' }, { text: `What's New`, activation: 'shiru://changelog/' }],
          activation: {
            type: 'protocol',
            launch: 'shiru://show/'
          }
        })
      }
    }
  })

  const updateProgress = writable(0)
  IPC.on('update-progress', progress => updateProgress.set(progress))
  setTimeout(() => IPC.emit('update'), 2_500).unref?.()
  setInterval(() => IPC.emit('update'), 300_000).unref?.()
</script>
<script>
  $: $updateState === 'ready' && modal.open(modal.UPDATE_PROMPT)
  $: ($updateState === 'up-to-date' || $updateState === 'downloading') && close()
  $: updating = false
  let updatePromise = createDeferred()

  function close(ignored = false) {
    if (updating) return
    if (ignored) $updateState = 'ignored'
    modal.close(modal.UPDATE_PROMPT)
  }

  function confirm() {
    if (updating) return
    updating = true
    updatePromise = createDeferred()
    const id = toast.loading(SUPPORTS.isAndroid ? 'Downloading Update' : 'Preparing Update', { duration: Infinity, description: SUPPORTS.isAndroid ? 'Please wait while the latest version is downloaded...' : 'Please wait while the update is applied. The app will restart automatically...' })
    updatePromise.promise.then(() => {
      toast.success('Update Complete', {
        id, duration: 6_000, description: 'Update was successfully applied. The app will now restart...'
      })
    }).catch(() => {
      toast.error(SUPPORTS.isAndroid ? 'Update Aborted' : 'Update Failed', {
        id, duration: 15_000, description: SUPPORTS.isAndroid ? 'Update was not installed. The process was canceled or an error occurred.' : 'Something went wrong during the update process!'
      })
    })
    IPC.emit('quit-and-install')
  }

  function compareVersions(currentVersion, previousVersion) {
    const a = sanitizeVersion(currentVersion).split('.').map(Number)
    const b = sanitizeVersion(previousVersion).split('.').map(Number)
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const numA = a[i] || 0
      const numB = b[i] || 0
      if (numA > numB) return 1
      if (numA < numB) return -1
    }
    return 0
  }

  IPC.on('update-aborted', (aborted) => {
    if (!updating) return
    updating = false
    $updateProgress = 0
    if (aborted) $updateState = 'aborted'
    updatePromise.reject()
  })
</script>

<SoftModal class='m-0 pt-0 d-flex flex-column rounded bg-very-dark scrollbar-none viewport-md-4-3 border-md w-full h-full rounded-10' css='z-105 m-0 p-0 modal-soft-ellipse' innerCss='m-0 p-0' showModal={$modal[modal.UPDATE_PROMPT]} close={() => {}} id={modal.UPDATE_PROMPT}>
  <p class='mt-20 px-20 px-md-40 overflow-y-auto'>
    {#await getChangelog($updateVersion)}
      <ChangelogSk />
    {:then changelog}
      {@const isLesser = changelog?.previousVersion && (compareVersions(version, changelog.previousVersion) < 0 || (compareVersions(version, changelog.previousVersion) > 0 && compareVersions(version, latestVersion) < 0))}
      <div class='row px-md-20 position-relative'>
        <div class='text-muted w-full mt-30 mt-md-0'>
          <h3 class='font-weight-bold text-white title font-scale-34 d-flex mb-5'><BadgeAlert class='mr-20 block-scale-43' strokeWidth='2'/> Update Available!</h3>
          <div class='font-scale-20'>{latestVersion} - {changelog?.entry ? new Date(changelog.entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div>
          <hr class='my-20'>
          <div class='mt-20' class:d-none={!isLesser}>
            It looks like you're upgrading from an earlier version, consider checking out the <span class='custom-link' use:click={() => IPC.emit('open', 'https://github.com/50n50/Tsumi/releases')}>past release notes</span>.
          </div>
          <div class:mt-20={!isLesser}>

          </div>
          <hr class='my-20'/>
          {#if changelog?.entry?.body?.trim().length}
            <h4 class='mt-0 font-weight-bold text-white'>Changelog</h4>
            <Changelog class='ml-10' body={changelog.entry.body} />
          {/if}
        </div>
      </div>
      <div class='mt-20'><span class='custom-link font-weight-bold d-flex' class:d-none={!changelog?.entry?.url} use:click={() => IPC.emit('open', changelog.entry.url)}>View on GitHub <ExternalLink class='ml-10' size='1.8rem' /></span></div>
      <div class='mt-20 font-italic' class:d-none={!SUPPORTS.isAndroid}>This update was delivered directly from the GitHub release. If you originally downloaded this app from F-Droid or IzzyOnDroid, note that updating through this method bypasses the extra review and screening normally conducted by those platforms.</div>
    {:catch e}
      <ChangelogSk />
    {/await}
  </p>
  <div class='mt-auto border-top px-40'>
    <div class='d-flex my-20 flex-column-reverse flex-md-row font-enlarge-14'>
      <button class='btn btn-close mr-5 font-weight-bold rounded-2 w-full mt-10 mt-md-0 py-10 h-auto py-md-2 w-md-auto px-md-30' type='button' disabled={updating} on:click={() => close(true)}>Not now</button>
      <button class='btn btn-secondary update-button position-relative overflow-hidden border-0 text-dark font-weight-bold ml-md-auto rounded-2 w-full py-10 h-auto py-md-2 w-md-auto px-md-30' type='button' disabled={updating} on:click={confirm} style={updating && $updateProgress > 0 ? `--update-progress: ${$updateProgress}%` : ''}>{SUPPORTS.isAndroid && $updateState !== 'aborted' ? (!updating ? 'Download' : 'Downloading...') : (!updating ? 'Update' : 'Updating...')}</button>
    </div>
  </div>
</SoftModal>

<style>
  @media (hover: hover) and (pointer: fine) {
    .btn-close:hover {
      background-color: var(--gray-color-light) !important;
    }
  }
  .update-button::before {
    content: '';
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    height: 100%;
    width: var(--update-progress, 0%);
    border-radius: inherit;
    background: var(--white-color-dim);
    transition: width .3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
</style>