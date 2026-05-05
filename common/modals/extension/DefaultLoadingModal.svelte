<script context="module">
  import { modal } from "@/modules/navigation.js";
  import { settings } from "@/modules/settings.js";
  import {
    extensionManager,
    callExtensionFunction,
  } from "@/modules/extension.js";
  import { anilistClient } from "@/modules/anilist.js";
  import {
    files,
    nowPlaying as currentMedia,
  } from "@/components/MediaHandler.svelte";
  import { page } from "@/modules/navigation.js";
  import { parseStreamResponse } from "@/modules/streaming.js";
  import Debug from "debug";
  const debug = Debug("ui:default-loading");

  function titleScore(searchTitle, resultTitle) {
    if (!searchTitle || !resultTitle) return 0;
    const a = searchTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
    const b = resultTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
    if (a === b) return 100;
    if (b.includes(a) || a.includes(b)) return 90;
    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);
    const matches = aWords.filter((w) =>
      bWords.some((bw) => bw === w || (w.length > 2 && bw.includes(w))),
    ).length;
    return Math.min(
      Math.round((matches / Math.max(aWords.length, 1)) * 80),
      80,
    );
  }
</script>

<script>
  import SoftModal from "@/components/modals/SoftModal.svelte";
  import { Loader, AlertTriangle } from "lucide-svelte";
  import { onDestroy } from "svelte";

  $: data = $modal[modal.DEFAULT_LOADING]?.data;
  $: media = data?.media;
  $: episode = data?.episode || 1;

  let statusText = "Connecting to extension...";
  let failed = false;
  let failReason = "";
  let running = false;

  function close() {
    modal.close(modal.DEFAULT_LOADING);
  }

  function fail(reason, failMedia = media, failEpisode = episode) {
    close();
    modal.open(modal.EXTENSION_MENU, {
      media: failMedia,
      episode: failEpisode,
      defaultFailed: true,
      failReason: reason,
    });
  }

  function launchPlayer(
    streamData,
    episodeNum,
    capturedMedia,
    serverIndex = 0,
    server = null,
  ) {
    const url = server?.streamUrl || streamData.url;
    const headers = server?.headers || streamData.headers || {};

    $currentMedia = { media: capturedMedia, episode: episodeNum };
    files.set([
      {
        name: `${anilistClient.title(capturedMedia)} - Episode ${episodeNum}.mp4`,
        url,
        streamHeaders: headers,
        streamServers: streamData.servers || [],
        subtitle: streamData.subtitle || null,
        length: 0,
        media: {
          media: capturedMedia,
          episode: episodeNum,
          parseObject: {
            anime_title: anilistClient.title(capturedMedia),
            episode_number: episodeNum,
          },
        },
        activeServerIndex: serverIndex,
      },
    ]);

    page.navigateTo(page.PLAYER);
    close();
  }

  async function autoPlay() {
    if (running || !media) return;
    running = true;
    const capturedMedia = media;
    const capturedEpisode = episode;
    failed = false;
    failReason = "";
    statusText = "Connecting to extension...";

    const title = anilistClient.title(capturedMedia);
    const defaultKey = settings.value.defaultExtension;
    const defaultExt = extensionManager
      .getEnabled()
      .find((e) => e.key === defaultKey);

    if (!defaultExt) {
      fail(
        "Default extension not found or disabled",
        capturedMedia,
        capturedEpisode,
      );
      return;
    }

    try {
      statusText = "Searching...";
      const raw = await callExtensionFunction(
        defaultExt,
        "searchResults",
        title,
      );
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

      if (!Array.isArray(parsed) || !parsed.length) {
        fail(
          "No results found from default extension",
          capturedMedia,
          capturedEpisode,
        );
        return;
      }

      const scored = parsed
        .map((r) => ({
          ...r,
          extensionKey: defaultExt.key,
          score: titleScore(title, r.title),
        }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      statusText = "Extracting episodes...";

      const rawEps = await callExtensionFunction(
        defaultExt,
        "extractEpisodes",
        best.href,
      );
      const parsedEps =
        typeof rawEps === "string" ? JSON.parse(rawEps) : rawEps;
      const episodes = Array.isArray(parsedEps) ? parsedEps : [];

      if (!episodes.length) {
        fail(
          "No episodes found for this title",
          capturedMedia,
          capturedEpisode,
        );
        return;
      }

      let targetEp;
      const targetNumber =
        typeof episode === "object" ? episode.number : Number(episode);
      const targetLocal =
        typeof episode === "object" ? episode.localEpisode : null;
      const targetSeason = typeof episode === "object" ? episode.season : null;

      if (targetSeason != null && targetLocal != null) {
        targetEp = episodes.find(
          (ep) =>
            ep.season != null &&
            Number(ep.season) === targetSeason &&
            Number(ep.number) === targetLocal,
        );

        if (!targetEp) {
          targetEp = episodes.find((ep) =>
            ep.href?.match(
              new RegExp(`/${targetSeason}/${targetLocal}(?:/|$)`),
            ),
          );
        }

        if (!targetEp) {
          let currentInferredSeason =
            episodes[0]?.season != null ? Number(episodes[0].season) : 1;
          let lastNum = 0;
          for (const ep of episodes) {
            const num = Number(ep.number);
            if (ep.season == null) {
              if (num < lastNum) currentInferredSeason++;
              ep.inferredSeason = currentInferredSeason;
            } else {
              currentInferredSeason = Number(ep.season);
              ep.inferredSeason = currentInferredSeason;
            }
            lastNum = num;
          }
          targetEp = episodes.find(
            (ep) =>
              ep.inferredSeason === targetSeason &&
              Number(ep.number) === targetLocal,
          );
        }

        if (!targetEp) {
          const localMatches = episodes.filter(
            (ep) => Number(ep.number) === targetLocal,
          );
          if (localMatches.length === 1) targetEp = localMatches[0];
        }
      } else {
        targetEp = episodes.find((ep) => Number(ep.number) === targetNumber);
      }

      targetEp = targetEp || episodes[0];
      statusText = "Loading stream...";

      const rawStream = await callExtensionFunction(
        defaultExt,
        "extractStreamUrl",
        targetEp.href,
      );
      let streamData;
      try {
        streamData = parseStreamResponse(rawStream);
      } catch {
        const url =
          typeof rawStream === "string"
            ? rawStream
            : rawStream?.url || rawStream?.streamUrl;
        if (url) streamData = { url, headers: {}, subtitle: null };
      }

      if (!streamData?.url) {
        fail("No stream URL found", capturedMedia, capturedEpisode);
        return;
      }

      // Handle multiple servers
      if (streamData.servers && streamData.servers.length > 1) {
        const episodeNum =
          typeof episode === "object"
            ? episode.number
            : targetEp.number || capturedEpisode;
        close();
        modal.open(modal.SERVER_SELECTOR, {
          servers: streamData.servers,
          onSelect: (i) =>
            launchPlayer(
              streamData,
              episodeNum,
              capturedMedia,
              i,
              streamData.servers[i],
            ),
          onBack: () => {},
        });
        return;
      }

      launchPlayer(
        streamData,
        typeof episode === "object"
          ? episode.number
          : targetEp.number || capturedEpisode,
        capturedMedia,
      );
    } catch (error) {
      debug("Default extension auto-play failed:", error);
      fail(error?.message || "Stream failed", capturedMedia, capturedEpisode);
    }
  }

  $: if (data && media) {
    running = false;
    autoPlay();
  }

  onDestroy(() => {
    running = false;
  });
</script>

<SoftModal
  class="m-0 wm-400 rounded bg-very-dark p-30"
  bind:showModal={$modal[modal.DEFAULT_LOADING]}
  {close}
  id={modal.DEFAULT_LOADING}
>
  <div
    class="d-flex flex-column align-items-center justify-content-center py-20"
  >
    <Loader size="3.5rem" class="spinning text-primary mb-20" />
    <h5 class="mb-5 font-weight-bold text-white text-center title-truncate">
      {anilistClient.title(media)}
    </h5>
    <span class="text-muted font-scale-14 text-center">Episode {episode}</span>
    <span class="text-muted font-scale-14 mt-15">{statusText}</span>
  </div>
</SoftModal>

<style>
  .title-truncate {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    max-width: 100%;
  }
  :global(.spinning) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
