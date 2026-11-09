<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { GalleryFile } from "$lib/data/chatModels";
  import type { CconnectBlock, SuggestionPicker } from "$lib/markdown/cconnectBlock";
  import { layout } from "$lib/platform/layout.svelte";
  import { servedSrc } from "$lib/services/mediaSource";
  import { awaitSharedFile } from "$lib/services/sharedArrival.svelte";
  import InstallCards from "$lib/screens/install/InstallCards.svelte";
  import PdfView from "$lib/screens/shared/PdfView.svelte";
  import MarkdownImage from "./MarkdownImage.svelte";
  import PageFrame from "./PageFrame.svelte";
  import CardPanel from "./CardPanel.svelte";
  import ExpandButton from "./ExpandButton.svelte";
  import { MEDIA_FRAME_CLASS } from "./mediaFrame";
  import { ROUND_ARROW_CLASS, ROUND_ICON_SIZE } from "./roundButton";
  import SuggestionChips from "./SuggestionChips.svelte";

  interface Props {
    data: CconnectBlock;
    onOpen: (url: string, filename: string, gallery?: GalleryFile[]) => void;
    compact?: boolean;
    onSuggest?: SuggestionPicker | null;
  }

  const { data, onOpen, compact = false, onSuggest = null }: Props = $props();

  const MEDIA_HEIGHT = $derived(compact ? "h-48" : "h-96");
  const DOC_HEIGHT = $derived(compact ? "14rem" : "32rem");
  const ARROW_CLASS = `${ROUND_ARROW_CLASS} pointer-events-auto`;
  const IMAGE_WIDTH = $derived(compact ? "13.333rem" : "23.333rem");
  const PEEK = "2.5rem";
  const RAIL_WIDTH = $derived(`min(100%, calc(${IMAGE_WIDTH} + ${PEEK} * 2))`);

  const fileName = (url: string) => {
    const clean = url.split(/[?#]/)[0];
    return decodeURIComponent(clean.slice(clean.lastIndexOf("/") + 1)) || clean;
  };

  const openInGallery = $derived.by(() => {
    if (data.type !== "gallery" || data.items.length < 2) return onOpen;
    const gallery = data.items.map((item) => ({ url: item.url, name: fileName(item.url), poster: item.poster }));
    return (url: string, filename: string) => onOpen(url, filename, gallery);
  });

  let track = $state<HTMLDivElement | null>(null);
  let page = $state(0);
  let pdfFailed = $state<"missing" | "broken" | null>(null);

  $effect(() => {
    if (data.type !== "pdf" || pdfFailed !== "missing") return;
    return awaitSharedFile(data.url, () => (pdfFailed = null));
  });

  const goto = (index: number) => {
    const child = track?.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const syncPage = () => {
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let closest = Number.POSITIVE_INFINITY;
    for (const [index, child] of [...track.children].entries()) {
      const el = child as HTMLElement;
      const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (distance < closest) {
        closest = distance;
        best = index;
      }
    }
    page = best;
  };
</script>

{#snippet expand(url: string)}
  <ExpandButton label={fileName(url)} onclick={() => onOpen(url, fileName(url))} />
{/snippet}

{#snippet media(item: { url: string; alt?: string; poster?: string })}
  <MarkdownImage url={item.url} alt={item.alt ?? ""} poster={item.poster} onOpen={openInGallery} {compact} />
{/snippet}

{#if data.type === "gallery"}
  {#if data.items.length === 1}
    <div class="flex w-full justify-center select-none">{@render media(data.items[0])}</div>
  {:else}
    <div class="flex w-full flex-col items-center gap-2 select-none">
      <div class="relative flex items-center" style="width: {RAIL_WIDTH}">
        <div
          bind:this={track}
          onscroll={syncPage}
          class="no-scrollbar flex w-full snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-smooth"
          style="padding-left: {PEEK}; padding-right: {PEEK};"
        >
          {#each data.items as item (item.url)}
            <div
              class="flex shrink-0 snap-center justify-center"
              style="width: min({IMAGE_WIDTH}, 100%)"
            >
              {@render media(item)}
            </div>
          {/each}
        </div>
        <div class="pointer-events-none absolute inset-0 flex items-center justify-between">
          <button
            type="button"
            class={ARROW_CLASS}
            disabled={page === 0}
            aria-label="previous"
            onclick={() => goto(page - 1)}
          >
            <ChevronLeft size={ROUND_ICON_SIZE} />
          </button>
          <button
            type="button"
            class={ARROW_CLASS}
            disabled={page >= data.items.length - 1}
            aria-label="next"
            onclick={() => goto(page + 1)}
          >
            <ChevronRight size={ROUND_ICON_SIZE} />
          </button>
        </div>
      </div>
      <div class="flex h-2 items-center gap-1.5">
        {#each data.items as _item, index (index)}
          <button
            type="button"
            aria-label={`${index + 1}`}
            onclick={() => goto(index)}
            class="cursor-pointer rounded-full transition-all {index === page
              ? 'size-2 bg-accent'
              : 'size-1.5 bg-accent/30'}"
          ></button>
        {/each}
      </div>
    </div>
  {/if}
{:else if data.type === "playlist"}
  <CardPanel class="w-full gap-2 {MEDIA_FRAME_CLASS}">
    {#each data.items as item (item.url)}
      <div class="flex w-full min-w-0 flex-col gap-1">
        <span class="truncate text-body-sm text-on-surface-variant">{item.title ?? fileName(item.url)}</span>
        <audio use:servedSrc={{ url: item.url }} controls class="w-full"></audio>
      </div>
    {/each}
  </CardPanel>
{:else if data.type === "suggestions"}
  <SuggestionChips items={data.items} onSelect={onSuggest} />
{:else if data.type === "install"}
  <InstallCards items={data.items} />
{:else if data.type === "pdf"}
  {#if pdfFailed}
    <a
      href={data.url}
      target="_blank"
      rel="noreferrer"
      class="text-accent underline"
    >
      {data.title ?? fileName(data.url)}
    </a>
  {:else}
    <div class="relative w-full select-none">
      <div
        class="flex w-full overflow-hidden {MEDIA_FRAME_CLASS} bg-card"
        style="height: {DOC_HEIGHT}"
      >
        <PdfView
          url={data.url}
          zoomable={!layout.mobile}
          onerror={(missing) => (pdfFailed = missing ? "missing" : "broken")}
        />
      </div>
      {@render expand(data.url)}
    </div>
  {/if}
{:else}
  <div class="relative w-full select-none">
    <div class="flex w-full overflow-hidden {MEDIA_FRAME_CLASS} bg-card {MEDIA_HEIGHT}">
      <PageFrame
        url={data.url}
        name={fileName(data.url)}
        title={data.title ?? fileName(data.url)}
        class="size-full"
      />
    </div>
    {@render expand(data.url)}
  </div>
{/if}
