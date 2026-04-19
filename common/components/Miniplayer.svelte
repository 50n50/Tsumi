<script context="module">
  import { readable } from "simple-store-svelte";

  const mql = matchMedia("(min-width: 769px)");
  export const isMobile = readable(!mql.matches, (set) => {
    const check = ({ matches }) => set(!matches);
    mql.addEventListener("change", check);
    return () => mql.removeEventListener("change", check);
  });

  const smql = matchMedia("(min-width: 1300px)");
  export const isSuperSmall = readable(!smql.matches, (set) => {
    const check = ({ matches }) => set(!matches);
    smql.addEventListener("change", check);
    return () => mql.removeEventListener("change", check);
  });
</script>

<script>
  import { onMount, onDestroy } from "svelte";
  import { cache, caches } from "@/modules/cache.js";
  import { page, modal } from "@/modules/navigation.js";
  import { settings } from "@/modules/settings.js";
  import { SUPPORTS } from "@/modules/support.js";

  export let active = false;
  export let padding = "1rem";
  const tmppadding = padding;
  const fixedMobileWidth = 25;
  let rootFontSize = 16;
  let minWidth = "0rem";
  let maxWidth = "100rem";
  const maxWidthRatio = 0.4;
  let widthRatio = null;
  let widthPx = 0;
  let width = "0rem";
  let height = "0px";
  let left = "0px";
  let top = "0px";
  let container = null;
  let dragging = false;
  let dragId = 1;

  $: draggingPos = "";
  $: resize = !$isMobile;
  let position =
    cache.getEntry(caches.GENERAL, "posMiniplayer") || "bottom right";
  $: if (!dragging)
    position =
      cache.getEntry(caches.GENERAL, "posMiniplayer") || "bottom right";
  $: if (!dragging) cache.setEntry(caches.GENERAL, "posMiniplayer", position);

  // Derive booleans so Svelte sees these classes at compile time
  $: posBottom = /bottom/i.test(position) || /bottom/i.test(draggingPos);
  $: posTop = /top/i.test(position) || /top/i.test(draggingPos);
  $: posLeft = /left/i.test(position) || /left/i.test(draggingPos);
  $: posRight = /right/i.test(position) || /right/i.test(draggingPos);

  $: minWidthRatio = $isSuperSmall ? 0.25 : 0.15;
  $: playerPage =
    $page === page.PLAYER &&
    (!$modal || !modal.length || !modal.exists(modal.ANIME_DETAILS));
  $: paddingTop = (() => {
    if (!active || (!position.match(/top/i) && !draggingPos.match(/top/i)))
      return padding;
    if ($page === page.SETTINGS && (!$modal || !modal.length))
      return !$isSuperSmall
        ? SUPPORTS.isAndroid
          ? padding
          : "4rem"
        : SUPPORTS.isAndroid
          ? "9rem"
          : "13rem";
    return SUPPORTS.isAndroid ? padding : "4rem";
  })();
  $: paddingLeft = (() => {
    if (!active || (!position.match(/left/i) && !draggingPos.match(/left/i)))
      return padding;
    if ($page === page.SETTINGS && (!$modal || !modal.length) && !$isSuperSmall)
      return "32rem";
    return padding;
  })();

  function draggable(node) {
    const initial = { x: 0, y: 0 };
    let timeout = null;

    function dragStart(event) {
      clearTimeout(timeout);
      dragging = true;
      padding = "0rem";
      const bounds = container.getBoundingClientRect();
      const relativeBounds =
        container.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };

      // Initialize top/left so we don't jump to 0,0 when position is cleared
      left = bounds.left + "px";
      top = bounds.top + "px";
      position = "";
      
      const { pointerId } = event;
      const point = event.touches?.[0] ?? event;

      initial.x = point.clientX - (bounds.left - relativeBounds.left);
      initial.y = point.clientY - (bounds.top - relativeBounds.top);

      widthPx = bounds.width;
      width = widthPx + "px";
      height = bounds.height + "px";

      // Direct DOM update for immediate feedback
      if (container) {
        container.style.setProperty("--left", left);
        container.style.setProperty("--top", top);
      }

      window.addEventListener("touchmove", handleDrag, { passive: false });
      window.addEventListener("pointermove", handleDrag);
      window.addEventListener("touchend", dragEnd);
      window.addEventListener("pointerup", dragEnd);
      if (pointerId) node.setPointerCapture(pointerId);
    }

    function dragEnd(event) {
      window.removeEventListener("touchmove", handleDrag);
      window.removeEventListener("pointermove", handleDrag);
      window.removeEventListener("touchend", dragEnd);
      window.removeEventListener("pointerup", dragEnd);

      const { clientX, clientY, pointerId } = event;
      dragging = false;
      padding = tmppadding;
      const point = event.changedTouches?.[0] ?? { clientX, clientY };
      const istop = window.innerHeight / 2 - point.clientY >= 0;
      const isleft = window.innerWidth / 2 - point.clientX >= 0;
      
      top = istop ? padding : `calc(100% - ${height})`;
      left = isleft ? padding : `calc(100% - ${width})`;
      
      if (pointerId) node.releasePointerCapture(pointerId);
      draggingPos = istop ? " top" : " bottom";
      draggingPos += isleft ? " left" : " right";
      dragId++;
      let currentDragId = dragId;
      timeout = setTimeout(() => {
        if (currentDragId === dragId) {
          position = istop ? "top" : "bottom";
          position += isleft ? " left" : " right";
          draggingPos = "";
        }
      }, 0);
    }

    function handleDrag(event) {
      event.preventDefault?.();
      const { clientX, clientY, touches } = event;
      const point = touches?.[0] ?? { clientX, clientY };
      left = point.clientX - initial.x + "px";
      top = point.clientY - initial.y + "px";
      
      // Direct DOM update for performance and reliability
      if (container) {
        container.style.setProperty("--left", left);
        container.style.setProperty("--top", top);
      }
    }

    node.addEventListener("pointerdown", dragStart);
    return {
      destroy() {
        node.removeEventListener("pointerdown", dragStart);
        window.removeEventListener("touchmove", handleDrag);
        window.removeEventListener("pointermove", handleDrag);
        window.removeEventListener("touchend", dragEnd);
        window.removeEventListener("pointerup", dragEnd);
      },
    };
  }

  $: {
    const parsedWidth = parseEntry(width);
    let w_px = 0;
    if (parsedWidth?.type === "rem") w_px = remToPixels(parsedWidth.rem);
    else if (parsedWidth?.type === "px") w_px = parsedWidth.px;
    else if (parsedWidth?.type === "ratio") w_px = parsedWidth.ratio * window.innerWidth;
    else if (parsedWidth?.type === "percent") w_px = (parsedWidth.percent / 100) * window.innerWidth;
    
    if (w_px > 0) {
      height = (w_px / 1.777) + "px";
    }
  }

  function resizable(node) {
    let startRatio = 0;
    let startX = 0;

    function resizeStart({ clientX, touches, pointerId }) {
      startX = touches?.[0]?.clientX ?? clientX;
      startRatio = widthRatio ?? minWidthRatio;
      document.body.addEventListener("pointermove", handleResize);
      if (pointerId) node.setPointerCapture(pointerId);
    }

    function handleResize({ clientX }) {
      if (clientX == null) return;
      widthRatio =
        startRatio +
        ((clientX - startX) / window.innerWidth) *
          (position?.match(/left/i) ? 1 : -1);
      widthRatio = Math.max(minWidthRatio, Math.min(maxWidthRatio, widthRatio));
      width = `${pixelsToRem(widthRatio * window.innerWidth)}rem`;
    }

    function resizeEnd({ pointerId }) {
      document.body.removeEventListener("pointermove", handleResize);
      if (pointerId) node.releasePointerCapture(pointerId);
      cacheRatio();
    }

    node.addEventListener("pointerdown", resizeStart);
    node.addEventListener("pointerup", resizeEnd);
    node.addEventListener("touchend", resizeEnd, { passive: false });
    return {
      destroy() {
        node.removeEventListener("pointerdown", resizeStart);
        node.removeEventListener("pointerup", resizeEnd);
        node.removeEventListener("touchend", resizeEnd);
      },
    };
  }

  const remToPixels = (rem) => rem * rootFontSize;
  const pixelsToRem = (pixels) => pixels / rootFontSize;
  function parseEntry(entry) {
    if (entry == null) return null;
    if (typeof entry === "number") {
      if (entry > 0 && entry <= 1) return { type: "ratio", ratio: entry };
      return { type: "px", px: entry };
    }
    const stringEntry = String(entry).trim();
    if (/^\d*\.?\d+$/.test(stringEntry)) {
      const floatEntry = parseFloat(stringEntry);
      if (floatEntry > 0 && floatEntry <= 1)
        return { type: "ratio", ratio: floatEntry };
      return { type: "px", px: floatEntry };
    }
    if (stringEntry.endsWith("px"))
      return { type: "px", px: parseFloat(stringEntry) };
    if (stringEntry.endsWith("rem"))
      return { type: "rem", rem: parseFloat(stringEntry) };
    if (stringEntry.endsWith("%"))
      return { type: "percent", percent: parseFloat(stringEntry) };
    return null;
  }

  function cacheRatio() {
    if ($isMobile) return;
    if (widthRatio == null) return;
    cache.setEntry(caches.GENERAL, "widthMiniplayer", widthRatio);
  }
  async function calculateWidth() {
    await new Promise((resolve) => setTimeout(resolve));
    rootFontSize =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if ($isMobile) {
      width = `${fixedMobileWidth}rem`;
      minWidth = `${fixedMobileWidth}rem`;
      maxWidth = `${fixedMobileWidth}rem`;
      return;
    }
    const cachedWidth = cache.getEntry(caches.GENERAL, "widthMiniplayer");
    if (widthRatio == null && cachedWidth != null) {
      const parsedWidth = parseEntry(cachedWidth);
      if (parsedWidth) {
        if (parsedWidth.type === "ratio") widthRatio = parsedWidth.ratio;
        else if (parsedWidth.type === "px")
          widthRatio = parsedWidth.px / window.innerWidth;
        else if (parsedWidth.type === "rem")
          widthRatio = remToPixels(parsedWidth.rem) / window.innerWidth;
        else if (parsedWidth.type === "percent")
          widthRatio = parsedWidth.percent / 100;
      }
    }
    if (widthRatio == null) widthRatio = minWidthRatio;
    const _widthRatio = Math.max(
      minWidthRatio,
      Math.min(maxWidthRatio, widthRatio),
    );
    if (!($isSuperSmall && widthRatio <= minWidthRatio))
      widthRatio = _widthRatio;
    width = `${pixelsToRem(_widthRatio * window.innerWidth)}rem`;
    minWidth = `${minWidthRatio * 100}%`;
    maxWidth = `${maxWidthRatio * 100}%`;
    cacheRatio();
  }

  onMount(() => {
    calculateWidth();
    window.addEventListener("resize", calculateWidth);
  });
  onDestroy(() => window.removeEventListener("resize", calculateWidth));
</script>

<div
  class="miniplayer-container z-55 {$$restProps.class}"
  class:active
  class:animate={!dragging}
  class:custompos={!position}
  class:player-page={playerPage}
  class:bottom={posBottom}
  class:top={posTop}
  class:left={posLeft}
  class:right={posRight}
  style:--left={left}
  style:--top={top}
  style:--height={height}
  style:--width={width}
  style:--padding={padding}
  style:--padding-top={paddingTop}
  style:--padding-left={paddingLeft}
  style:--padding-bottom={padding}
  style:--padding-right={padding}
  style:--maxwidth={maxWidth}
  style:--minwidth={minWidth}
  class:z-5={$page === page.SETTINGS && !dragging && (!$modal || !modal.length)}
  role="group"
  bind:this={container}
  on:dragstart|preventDefault|self
>
  <div
    class="resize"
    class:resize-tl={posTop && posLeft}
    class:resize-tr={posTop && posRight}
    class:resize-bl={posBottom && posLeft}
    class:resize-br={posBottom && posRight}
    class:d-none={!resize || !active}
    use:resizable
  />
  <slot />
  <div
    class="miniplayer-footer touch-none"
    style="z-index: 101 !important;"
    class:dragging
    use:draggable
    tabindex="-1"
  >
    ::::
  </div>
</div>

<style>
  .resize {
    background: transparent;
    position: absolute;
    user-select: none;
    width: 1.5rem;
    height: 1.5rem;
    z-index: 100;
  }
  .resize-tl {
    top: 0;
    left: 0;
    cursor: nw-resize;
  }
  .resize-tr {
    top: 0;
    right: 0;
    cursor: sw-resize;
  }
  .resize-bl {
    bottom: 0;
    left: 0;
    margin-bottom: 2.2rem;
    cursor: sw-resize;
  }
  .resize-br {
    bottom: 0;
    right: 0;
    margin-bottom: 2.2rem;
    cursor: nw-resize;
  }
  .active {
    position: absolute;
    pointer-events: auto;
    width: clamp(var(--minwidth), var(--width), var(--maxwidth)) !important;
  }
  .player-page {
    pointer-events: auto;
  }
  .active.custompos {
    top: clamp(
      var(--padding),
      var(--top),
      100% - var(--height) - var(--padding)
    ) !important;
    left: clamp(
      var(--padding),
      var(--left),
      100% - var(--width) - var(--padding)
    ) !important;
    height: var(--height) !important;
  }
  .active.top {
    top: var(--padding) !important;
  }
  .active.bottom {
    top: calc(100% - var(--height) - var(--padding)) !important;
  }
  .active.left {
    left: var(--padding) !important;
  }
  .active.right {
    left: calc(100% - var(--width) - var(--padding)) !important;
  }
  .animate {
    transition-duration: 0.5s;
    transition-property: top, left;
    transition-timing-function: cubic-bezier(0.3, 1.5, 0.8, 1);
  }
  .miniplayer-footer {
    display: none;
    letter-spacing: 0.15rem;
    cursor: grab;
    font-weight: 600;
    user-select: none;
    padding-bottom: 0.2rem;
    text-align: center;
    position: relative;
    z-index: 101 !important;
    pointer-events: auto !important;
  }
  .miniplayer-border {
    box-shadow: 0 0 0.2rem 0.05rem var(--dark-color-very-light) !important;
  }
  .dragging {
    cursor: grabbing !important;
  }
  .active > .miniplayer-footer {
    display: block !important;
  }
</style>
