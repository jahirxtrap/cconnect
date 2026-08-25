<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import { isVideo } from "$lib/data/previewKind";
  import type { CconnectBlock } from "$lib/markdown/cconnectBlock";
  import { mediaSrc } from "$lib/services/mediaSource";
  import PdfView from "$lib/screens/files/PdfView.svelte";
  import MarkdownImage from "./MarkdownImage.svelte";
  import OutlinedPanel from "./OutlinedPanel.svelte";

  interface Props {
    data: CconnectBlock;
    onOpen: (url: string, filename: string) => void;
    compact?: boolean;
  }

  const { data, onOpen, compact = false }: Props = $props();

  const MEDIA_HEIGHT = $derived(compact ? "h-48" : "h-96");
  const DOC_HEIGHT = $derived(compact ? "14rem" : "32rem");
  const ARROW_CLASS =
    "pointer-events-auto inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-variant text-on-surface transition-opacity disabled:cursor-default disabled:opacity-50";
  const IMAGE_WIDTH = $derived(compact ? "13.333rem" : "23.333rem");
  const PEEK = "2.5rem";
  const RAIL_WIDTH = $derived(`min(100%, calc(${IMAGE_WIDTH} + ${PEEK} * 2))`);

  const fileName = (url: string) => {
    const clean = url.split(/[?#]/)[0];
    return decodeURIComponent(clean.slice(clean.lastIndexOf("/") + 1)) || clean;
  };

  let track = $state<HTMLDivElement | null>(null);
  let page = $state(0);
  let pdfFailed = $state(false);

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
  <button
    type="button"
    onclick={() => onOpen(url, fileName(url))}
    aria-label={fileName(url)}
    class="absolute top-2 right-2 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-surface-variant text-on-surface opacity-90 transition-opacity hover:opacity-100"
  >
    <Ellipsis size={16} />
  </button>
{/snippet}

{#snippet media(item: { url: string; alt?: string; poster?: string })}
  {#if isVideo(item.url)}
    <div
      class="flex aspect-4/3 max-w-full {compact ? 'h-40' : 'h-70'} items-center justify-center overflow-hidden rounded-panel border border-outline-variant bg-black"
    >
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        use:mediaSrc={{ url: item.url }}
        poster={item.poster}
        controls
        class="max-h-full max-w-full object-contain"
      ></video>
    </div>
  {:else}
    <MarkdownImage url={item.url} alt={item.alt ?? ""} {onOpen} {compact} />
  {/if}
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
        <button
          type="button"
          class="{ARROW_CLASS} absolute left-0"
          disabled={page === 0}
          aria-label="previous"
          onclick={() => goto(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          class="{ARROW_CLASS} absolute right-0"
          disabled={page >= data.items.length - 1}
          aria-label="next"
          onclick={() => goto(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
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
  <OutlinedPanel class="w-full gap-2">
    {#each data.items as item (item.url)}
      <div class="flex w-full min-w-0 flex-col gap-1">
        <span class="truncate text-body-sm text-on-surface-variant">{item.title ?? fileName(item.url)}</span>
        <audio use:mediaSrc={{ url: item.url }} controls class="w-full"></audio>
      </div>
    {/each}
  </OutlinedPanel>
{:else if data.type === "pdf"}
  {#if pdfFailed}
    <a href={data.url} target="_blank" rel="noreferrer" class="text-accent underline">
      {data.title ?? fileName(data.url)}
    </a>
  {:else}
    <div class="relative w-full select-none">
      <div
        class="flex w-full overflow-hidden rounded-panel border-2 border-outline-variant"
        style="height: {DOC_HEIGHT}"
      >
        <PdfView url={data.url} onerror={() => (pdfFailed = true)} />
      </div>
      {@render expand(data.url)}
    </div>
  {/if}
{:else}
  <div class="relative w-full select-none">
    <iframe
      use:mediaSrc={{ url: data.url }}
      title={data.title ?? fileName(data.url)}
      sandbox="allow-scripts allow-popups"
      referrerpolicy="no-referrer"
      class="w-full rounded-panel border-2 border-outline-variant bg-surface {MEDIA_HEIGHT}"
    ></iframe>
    {@render expand(data.url)}
  </div>
{/if}
