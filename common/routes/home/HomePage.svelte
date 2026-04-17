<script context="module">
  import SectionsManager, { sections } from "@/modules/sections.js";
  import {
    anilistClient,
    currentSeason,
    currentYear,
  } from "@/modules/anilist.js";
  import { tmdbClient } from "@/modules/tmdb.js";
  import { animeSchedule } from "@/modules/anime/animeschedule.js";
  import { settings } from "@/modules/settings.js";
  import { uniqueStore } from "@/modules/util.js";
  import equal from "fast-deep-equal/es6";
  import { RSSManager } from "@/modules/rss.js";
  import Helper from "@/modules/helper.js";
  import WPC from "@/modules/wpc.js";
  import { writable } from "simple-store-svelte";
  import Debug from "debug";
  const debug = Debug("ui:home");

  const bannerData = writable(getTitles());
  setInterval(() => getTitles(true), 5 * 60 * 1000);

  async function getTitles(refresh) {
    const provider = settings.value.bannerProvider || "mix";
    const limit = 50;

    const anilistPromise =
      provider !== "western"
        ? anilistClient.search({
            method: "Search",
            ...(settings.value.adult === "hentai" && settings.value.hentaiBanner
              ? { genre: ["Hentai"] }
              : {}),
            sort: "TRENDING_DESC",
            perPage: limit,
            onList: false,
            ...(settings.value.adult !== "hentai" ||
            !settings.value.hentaiBanner
              ? { season: currentSeason }
              : {}),
            year: currentYear,
            status_not: "NOT_YET_RELEASED",
          })
        : null;

    const tmdbPromise =
      provider !== "anime"
        ? (async () => {
            const p1 = await tmdbClient.search({
              page: 1,
              sort: "TRENDING_DESC",
              format: ["TV", "MOVIE"],
              excludeAnime: true,
            });
            const p2 = await tmdbClient.search({
              page: 2,
              sort: "TRENDING_DESC",
              format: ["TV", "MOVIE"],
              excludeAnime: true,
            });
            return {
              results: [
                ...(p1?.data?.Page?.media || []),
                ...(p2?.data?.Page?.media || []),
              ],
            };
          })()
        : null;

    const res = Promise.all([anilistPromise, tmdbPromise]).then(
      async ([anilistRes, tmdbData]) => {
        const anilistMedia = anilistRes?.data?.Page?.media || [];
        const tmdbMedia = tmdbData?.results || [];

        if (anilistRes) await tmdbClient.injectTmdbImages(anilistRes);
        if (tmdbMedia?.length > 0)
          await tmdbClient.injectMediaImages(tmdbMedia);

        if (provider === "anime") return anilistRes;
        if (provider === "western")
          return {
            data: {
              Page: { pageInfo: { hasNextPage: false }, media: tmdbMedia },
            },
          };

        const mixed = [];
        const iterations = Math.max(anilistMedia.length, tmdbMedia.length);
        for (let i = 0; i < iterations; i++) {
          if (i < anilistMedia.length) mixed.push(anilistMedia[i]);
          if (i < tmdbMedia.length) mixed.push(tmdbMedia[i]);
        }
        return {
          data: { Page: { pageInfo: { hasNextPage: false }, media: mixed } },
        };
      },
    );

    if (refresh) {
      const renderData = await res;
      bannerData.set(Promise.resolve(renderData));
    } else return res;
  }

  let mappedSections = {};
  let manager = new SectionsManager();
  mapSections();
  WPC.listen("remap-sections", () => {
    manager.clear();
    mappedSections = {};
    mapSections();
    manager = manager;
  });

  function mapSections() {
    manager.clear();
    mappedSections = {};
    for (const section of sections.value)
      mappedSections[section.title] = section;
    for (const sectionTitle of settings.value.homeSections)
      if (mappedSections[sectionTitle[0]])
        manager.add(mappedSections[sectionTitle[0]]);
  }

  const continueWatching = "Continue Watching";
  const resolveData = async (data) =>
    Promise.all(
      data.map(async (item) => {
        const resolved =
          item.data && typeof item.data.then === "function"
            ? await item.data
            : item.data;
        const media = resolved?.media || resolved;
        return {
          ...item,
          data: media
            ? {
                id: media.id,
                idMal: media.idMal,
                title: media.title,
                bannerImage: media.bannerImage,
                isAdult: media.isAdult,
                duration: media.duration,
                episodes: media.episodes,
                format: media.format,
              }
            : resolved,
        };
      }),
    );
  if (Helper.getUser()) {
    refreshSections(
      Helper.getClient().userLists,
      ["Anime - Recent Dubs", "Anime - Recent Subs", "Hentai Releases"],
      true,
    );
    refreshSections(Helper.getClient().userLists, [
      continueWatching,
      "Sequels You Missed",
      "Stories You Missed",
      "Planning List",
      "Completed List",
      "Paused List",
      "Dropped List",
      "Watching List",
      "Rewatching List",
    ]);
  }
  if (Helper.isMalAuth())
    refreshSections(animeSchedule.subAiredLists, continueWatching);
  refreshSections(animeSchedule.dubAiredLists, continueWatching);

  function refreshSections(list, sections, schedule = false) {
    uniqueStore(list).subscribe(async (_value) => {
      const value = await _value;
      if (!value) return;
      for (const section of manager.sections) {
        if (
          sections.includes(section.title) &&
          !section.hide &&
          (!schedule || section.isSchedule)
        ) {
          const loaded = section.load(1, 50, section.variables);
          if (
            !section.preview.value ||
            !equal(
              await resolveData(loaded),
              await resolveData(section.preview.value),
            )
          )
            section.preview.value = loaded;
        }
      }
    });
  }

  WPC.listen("feedChanged", ({ updateFeeds, manifest }) => {
    for (const section of manager.sections) {
      try {
        if (section.isSchedule && updateFeeds.includes(section.title)) {
          animeSchedule
            .feedChanged(
              section.title.includes("Subbed")
                ? "Sub"
                : section.title.includes("Dubbed")
                  ? "Dub"
                  : "Hentai",
              false,
              true,
              manifest,
            )
            .then((changed) => {
              if (changed)
                section.preview.value = section.load(1, 50, section.variables);
            });
        }
      } catch (error) {
        debug(
          `Failed to update ${section.title} feed, this is likely a temporary connection issue:`,
          error,
        );
      }
    }
  });

  window.addEventListener("fileEdit", async () => {
    for (const section of manager.sections) {
      if (section.isRSS && !section.isSchedule) {
        const url = settings.value.rssFeedsNew.find(
          ([feedTitle]) => feedTitle === section.title,
        )?.[1];
        if (url) {
          const loaded = RSSManager.getMediaForRSS(1, 12, url, false, true);
          if (
            !section.preview.value ||
            !equal(
              await resolveData(loaded),
              await resolveData(section.preview.value),
            )
          )
            section.preview.value = loaded;
        }
      }
    }
  });

  const isPreviousRSS = (i) => {
    let index = i - 1;
    while (index >= 0) {
      if (!manager.sections[index]?.hide)
        return manager.sections[index]?.isRSS ?? false;
      else if (index - 1 >= 0 && manager.sections[index - 1]?.isRSS)
        return true;
      index--;
    }
    return false;
  };
</script>

<script>
  import HomeSection from "@/routes/home/components/HomeSection.svelte";
  import Banner from "@/components/banner/Banner.svelte";
  import { bannerImages, hideBanner } from "@/modules/bannerStore.js";

  let scrollContainer;

  function handleScroll(e) {
    hideBanner.value = e.target.scrollTop > 100;
  }

  export function checkScrollPosition() {
    if (scrollContainer) {
      hideBanner.value = scrollContainer.scrollTop > 100;
    } else {
      hideBanner.value = false;
    }
  }

  $: if ($bannerImages && scrollContainer) {
    hideBanner.value = scrollContainer.scrollTop > 100;
  }

  $: if ($settings) {
    getTitles(true);
    mapSections();
    manager = manager;
  }

  hideBanner.value = false;
</script>

<div
  class="h-full w-full overflow-y-scroll root overflow-x-hidden"
  on:scroll={handleScroll}
  bind:this={scrollContainer}
>
  <Banner data={$bannerData} />
  <div class="d-flex flex-column h-full w-full mt-15 pl-sm-30 pl-md-80">
    {#each manager.sections as section, i (i)}
      {#if !section.hide}
        <HomeSection bind:opts={section} lastEpisode={isPreviousRSS(i)} />
      {/if}
    {/each}
  </div>
</div>
