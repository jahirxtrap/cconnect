<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { PreviewRequest } from "$lib/app/navigation.svelte";
  import { isEditing } from "$lib/data/paneFocus.svelte";
  import { serverSettings } from "$lib/data/serverSettings.svelte";
  import { previewKindOf } from "$lib/data/previewKind";
  import { formatMediaTime } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { devicePixels, sizedImage } from "$lib/services/imageSize";
  import { mediaDuration } from "$lib/services/mediaDuration";
  import { imageSrc, servedSrc } from "$lib/services/mediaSource";
  import { videoStillOf } from "$lib/services/sharedApi";
  import { fileIcon } from "$lib/ui/fileIcons";
  import { ROUND_ARROW_CLASS } from "$lib/ui/roundButton";
  import { nearView } from "$lib/ui/nearView";
  import { HSCROLL_CLASS, hscrollbar } from "$lib/ui/scrollbar";
  import { TILE_FRAME_CLASS, TILE_IDLE_CLASS, TILE_LINE_CLASS, TILE_SELECTED_CLASS } from "$lib/ui/tile";

  interface Props {
    items: PreviewRequest[];
    index: number;
    onStep: (step: number) => void;
    onPick: (index: number) => void;
  }

  const { items, index, onStep, onPick }: Props = $props();

  const STEP_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

  $effect(() => serverSettings.ensure());

  let strip = $state<HTMLDivElement | null>(null);
  let tileSize = $state(0);
  let shown = $state<boolean[]>([]);
  let stillMissing = $state<Record<string, true>>({});

  const pixels = $derived(devicePixels(tileSize));

  $effect(() => {
    const child = strip?.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  });

  const onkeydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isEditing() || event.target instanceof HTMLMediaElement || event.target instanceof HTMLSelectElement) return;
    const step = STEP_KEYS[event.key];
    if (!step) return;
    event.preventDefault();
    onStep(step);
  };
</script>

<svelte:window {onkeydown} />

<div class="flex shrink-0 items-center gap-2 p-(--page-inset)">
  <button type="button" class={ROUND_ARROW_CLASS} disabled={index <= 0} aria-label={t("PREVIOUS_FILE")} onclick={() => onStep(-1)}>
    <ChevronLeft size={18} />
  </button>
  <div
    bind:this={strip}
    bind:clientHeight={tileSize}
    use:hscrollbar={{ wheel: true }}
    class="{HSCROLL_CLASS} flex min-w-0 flex-1 gap-1.5 rounded-lg"
  >
    {#each items as item, position (item.url)}
      {@const Icon = fileIcon(item.name)}
      {@const active = position === index}
      {@const kind = previewKindOf(item.name)}
      {@const still =
        kind === "image"
          ? item.url
          : stillMissing[item.url]
            ? null
            : (item.poster ?? (kind === "video" ? videoStillOf(item.url) : null))}
      {@const ready = shown[position] && pixels > 0}
      <button
        type="button"
        title={item.name}
        aria-current={active}
        use:nearView={() => (shown[position] = true)}
        onclick={() => onPick(position)}
        class="{TILE_FRAME_CLASS} size-14 shrink-0 cursor-pointer"
      >
        {#if still}
          {#if ready}
            <img
              use:imageSrc={{
                url: sizedImage(still, pixels),
                borrow: true,
                onerror: () => {
                  if (kind === "video") stillMissing[item.url] = true;
                },
              }}
              alt=""
              draggable="false"
              class="size-full object-cover"
            />
          {/if}
        {:else if kind === "video"}
          {#if ready && still === null}
            <video use:servedSrc={{ url: item.url }} preload="metadata" muted class="size-full object-cover"></video>
          {/if}
        {:else}
          <Icon size={20} class="absolute inset-0 m-auto text-on-surface-variant" />
        {/if}
        {#if kind === "video" && ready}
          {#await mediaDuration(item.url) then seconds}
            {#if seconds !== null}
              <span
                class="pointer-events-none absolute bottom-1 left-1/2 max-w-[calc(100%-0.5rem)] -translate-x-1/2 truncate rounded-sm bg-black/60 px-0.5 text-body-sm text-white tabular-nums"
                >{formatMediaTime(seconds)}</span
              >
            {/if}
          {/await}
        {/if}
        <span class="{TILE_LINE_CLASS} z-10 {active ? TILE_SELECTED_CLASS : TILE_IDLE_CLASS}"></span>
      </button>
    {/each}
  </div>
  <button
    type="button"
    class={ROUND_ARROW_CLASS}
    disabled={index >= items.length - 1}
    aria-label={t("NEXT_FILE")}
    onclick={() => onStep(1)}
  >
    <ChevronRight size={18} />
  </button>
</div>
