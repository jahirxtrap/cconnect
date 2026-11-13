<script module lang="ts">
  import type { PreviewKind } from "$lib/data/previewKind";

  export const GALLERY_KINDS: PreviewKind[] = ["image", "video", "audio"];
</script>

<script lang="ts">
  import type { PreviewRequest } from "$lib/app/navigation.svelte";
  import { previewKindOf } from "$lib/data/previewKind";
  import { fallbackOf, revised, withoutFallback } from "$lib/data/url";
  import { t } from "$lib/i18n/index.svelte";
  import { devicePixels, sizedImage } from "$lib/services/imageSize";
  import { imageSrc } from "$lib/services/mediaSource";
  import { videoStillOf } from "$lib/services/sharedApi";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { fileIcon } from "$lib/ui/fileIcons";
  import MediaPlayer from "$lib/ui/MediaPlayer.svelte";
  import ZoomPane from "$lib/ui/ZoomPane.svelte";
  import AudioStage from "./AudioStage.svelte";

  interface Props {
    item: PreviewRequest;
    active: boolean;
    revision: number;
    autoplay?: boolean;
    onEnded?: () => void;
  }

  const { item, active, revision, autoplay = false, onEnded }: Props = $props();

  const kind = $derived(item.kind ?? previewKindOf(item.name));
  const base = $derived(withoutFallback(item.url));
  const source = $derived(revised(base, revision));
  const fallback = $derived(fallbackOf(item.url));

  let height = $state(0);
  let loadedFor = $state<string | null>(null);
  let failedFor = $state<string | null>(null);

  const loaded = $derived(loadedFor === source);
  const failed = $derived(failedFor === source);
  const served = $derived(item.poster ? null : videoStillOf(base));
  const frame = $derived(
    item.poster ?? (served && height ? sizedImage(served, devicePixels(height)) : null),
  );
</script>

<div bind:clientHeight={height} class="relative flex min-h-0 flex-1 flex-col">
  {#if kind === "image"}
    <ZoomPane class="min-h-0 flex-1" {active}>
      <img
        use:imageSrc={{
          url: source,
          fallback,
          onload: () => (loadedFor = source),
          onerror: () => (failedFor = source),
        }}
        alt={item.name}
        draggable="false"
        data-native-menu
        class="h-full w-full object-contain {failed ? 'invisible' : ''}"
      />
      {#if failed}
        <EmptyState icon={fileIcon(item.name)} text={t("FILE_UNAVAILABLE")} class="absolute inset-0" />
      {:else if !loaded}
        <CenteredProgress class="absolute inset-0" />
      {/if}
    </ZoomPane>
  {:else if kind === "video" && active}
    <MediaPlayer url={source} kind="video" poster={frame} zoomable class="min-h-0 flex-1" />
  {:else if kind === "video"}
    <div class="flex min-h-0 flex-1 items-center justify-center">
      {#if frame}
        <img use:imageSrc={{ url: frame }} alt="" draggable="false" class="h-full w-full object-contain" />
      {/if}
    </div>
  {:else if kind === "audio" && failed}
    <EmptyState icon={fileIcon(item.name)} text={t("FILE_UNAVAILABLE")} class="flex-1" />
  {:else if kind === "audio"}
    <AudioStage
      url={source}
      {base}
      filename={item.name}
      {active}
      {autoplay}
      onerror={() => (failedFor = source)}
      onended={onEnded}
    />
  {:else}
    <EmptyState icon={fileIcon(item.name)} text={item.name} class="flex-1" />
  {/if}
</div>
