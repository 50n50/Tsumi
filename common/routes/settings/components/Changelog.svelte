<script context='module'>
  import { SUPPORTS } from '@/modules/support.js'
  import { IPC } from '@/modules/bridge.js'
  import Debug from 'debug'

  const debug = Debug('ui:changelog-view')
  export let changeLog = getChanges()
  export let latestVersion

  const startedAt = Date.now()
  window.addEventListener('online', () => changeLog = getChanges())
  IPC.on(SUPPORTS.isAndroid ? 'update-available' : 'update-downloaded', (version) => {
    if (latestVersion !== version) {
      latestVersion = version
      if ((Date.now() - startedAt) >= 30_000) changeLog = getChanges()
    }
  })

  async function getChanges() {
    try {
      const json = await (await fetch('https://api.github.com/repos/RockinChaos/Shiru/releases')).json()
      return json.map(({body, tag_name: version, published_at: date, assets, html_url: url}) => ({
        body,
        version,
        date,
        assets,
        url
      }))
    } catch (error) {
      debug('Failed to fetch changelog', error)
      return []
    }
  }
</script>
<script>
  import { marked } from 'marked'
  import DOMPurify from 'dompurify'
  import { click } from '@/modules/click.js'
  export let body = ''

  export function sanitize(body) {
    return DOMPurify.sanitize(marked.parse(body, {
      pedantic: false,
      breaks: true,
      gfm: true
    }), {
      ALLOWED_TAGS: [
        'p', 'br', 'span', 'div',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark',
        'ul', 'ol', 'li',
        'blockquote',
        'code', 'pre',
        'a',
        'img',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'hr',
        'details', 'summary',
        'input'
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel', 'title',
        'src', 'alt', 'width', 'height',
        'class', 'id',
        'align',
        'type', 'checked', 'disabled'
      ]
    })
  }

  function hrefListener(event) {
    const anchor = event.composedPath().find(element => element.tagName === 'A')
    if (!anchor?.href) return
    event.preventDefault()
    IPC.emit('open', anchor.href)
  }
</script>
<div class='changelog {$$restProps.class}' tabindex='-1' use:click={hrefListener}>{@html sanitize(body)}</div>
<style>
  .changelog :global(a) {
    -webkit-user-drag: none;
    color: var(--tertiary-color);
    cursor: pointer;
  }

  @media (hover: hover) and (pointer: fine) {
    .changelog :global(a):hover {
      text-decoration: underline;
      color: var(--tertiary-color-dim);
    }
  }

  .changelog :global(svg),
  .changelog :global(img),
  .changelog :global(video),
  .changelog :global(iframe) {
    -webkit-user-drag: none;
    max-width: 100%;
    height: auto;
    border-radius: 1rem;
  }

  .changelog :global(p),
  .changelog :global(details) {
    margin-block: 0.8rem;
  }
</style>