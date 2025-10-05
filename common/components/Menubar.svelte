<script>
  import { persisted } from 'svelte-persisted-store'
  import { getContext } from 'svelte'
  import { click } from '@/modules/click.js'
  import { SUPPORTS } from '@/modules/support.js'
  import IPC from '@/modules/ipc.js'

  export let page
  const view = getContext('view')
  function home() {
    $view = null
    page = 'home'
  }

  const debug = persisted('debug', '', {
    serializer: {
      parse: e => e,
      stringify: e => e
    }
  })
  $: fullscreen = false
  IPC.on('isFullscreen', (isFullscreen) => fullscreen = isFullscreen)
</script>

<div class='w-full z-101 navbar bg-transparent border-0 p-0 d-flex draggable'>
  <div class='controls-container d-none position-absolute top-0 {window.version?.platform !== `darwin` ? `right-0 ${window.version?.platform === `win32` ? `right-width-win` : `right-width-linux`}` : `left-0 left-width`} h-full' class:d-flex={!SUPPORTS.isAndroid && !fullscreen || window.version?.platform !== 'darwin'}/>
</div>
<div class='position-absolute' class:right-0={SUPPORTS.isAndroid}>
  <img src='./icon_filled.png' tabindex='-1' class='z-102 position-absolute w-50 h-50 m-10 pointer d-none p-5 transition-mt {window.version?.platform === `darwin` ? fullscreen ? `mt-20` : `mt-30` : ``}' class:d-md-block={!SUPPORTS.isAndroid} alt='ico' use:click={home} />
  {#if $debug}
    <div class='z-100 ribbon text-center position-absolute font-size-16 font-weight-bold pointer-events-none {!SUPPORTS.isAndroid ? `ribbon-left` : `ribbon-right`}'>Debug Mode</div>
  {/if}
</div>

<style>
  .transition-mt {
    transition: margin-top 0.1s ease-in-out;
  }
  .ribbon {
    background: var(--accent-color);
    box-shadow: 0 0 0 10rem var(--accent-color);
    clip-path: inset(0 -100%);
    opacity: 0.6;
  }
  .ribbon-left {
    min-width: 16rem;
    inset: 0 auto auto 0;
    transform-origin: 100% 0;
    transform: translate(-29.3%) rotate(-45deg);
  }
  .ribbon-right {
    min-width: 19rem;
    inset: 0 0 auto auto;
    transform-origin: 0 0;
    transform: translate(29.3%) rotate(45deg);
  }
  .draggable {
    -webkit-app-region: drag;
    color: var(--dm-text-muted-color);
    font-size: 11.2px;
    width: calc(env(titlebar-area-width, 100%) - 1px);
  }
  img {
    top: 0;
    -webkit-app-region: no-drag
  }
  .navbar {
    left: unset !important;
    --navbar-height: 28px !important;
  }
  @media (pointer: none), (pointer: coarse) {
    .navbar {
      display: none !important;
      height: 0;
    }
  }
  .controls-container {
    -webkit-app-region: no-drag;
    backdrop-filter: blur(8px);
    background: rgba(24, 24, 24, 0.2);
  }
  .right-width-win {
    width: 137px;
  }
  .right-width-linux {
    width: 97px;
  }
  .left-width {
    width: 67px;
    border-bottom-right-radius: var(--rounded-2-border-radius);
  }
</style>