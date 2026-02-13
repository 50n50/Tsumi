<script context='module'>
    import { Play } from 'lucide-svelte'
    import { click } from '@/modules/click.js'

    export function playActive(hash, search, magnet, prompt = true) {
        // Simplified play function - launches streaming modal to play anime
        window.dispatchEvent(new CustomEvent('play-anime', {
            detail: {
                id: search?.media?.id,
                episode: search?.episode
            }
        }))
    }
</script>
<script>
    import { settings } from '@/modules/settings.js'

    export let hash
    export let search
    export let torrentID = null
    export let size = '1.7rem'
    export let strokeWidth = '3'
    $: disabled = false
    $: activeHash = null
    $: downloaded = false
</script>
<button type='button' class='torrent-button d-flex align-items-center justify-content-center {$$restProps.class}' class:not-allowed={downloaded || disabled} class:not-reactive={downloaded || disabled} disabled={disabled && !downloaded} data-toggle='tooltip' data-placement='left' data-title='Play' use:click={() => { playActive(hash, search) }}>
    <Play {size} {strokeWidth} />
</button>
