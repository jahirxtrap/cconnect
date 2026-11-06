<script module lang="ts">
  import type { PreviewKind } from "$lib/data/previewKind";

  export const GALLERY_KINDS: PreviewKind[] = ["image", "video"];
</script>

<script lang="ts">
  import { devicePixelRatio } from "svelte/reactivity/window";
  import type { PreviewRequest } from "$lib/app/navigation.svelte";
  import { previewKindOf } from "$lib/data/previewKind";
  import { fallbackOf, revised, withoutFallback } from "$lib/data/url";
  import { t } from "$lib/i18n/index.svelte";
  import { imageSrc, posterSrc, servedSrc, sizedImage } from "$lib/services/mediaSource";
  import { videoStillOf } from "$lib/services/sharedApi";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { fileIcon } from "$lib/ui/fileIcons";
  import ZoomPane from "$lib/ui/ZoomPane.svelte";

  interface Props {
    item: PreviewRequest;
    active: boolean;
    revision: number;
  }

  const { item, active, revision }: Props = $props();

  const kind = $derived(item.kind ?? previewKindOf(item.name));
  const base = $derived(withoutFallback(item.url));
  const source = $derived(revised(base, revision));
  const fallback = $derived(fallbackOf(item.url));

  let height = $state(0);
  let loaded = $state(false);
  let failed = $state(false);

  const still = $derived(item.poster ?? videoStillOf(base));
  const frame = $derived(still && height ? sizedImage(still, Math.ceil(height * (devicePixelRatio.current ?? 1))) : null);

  $effect(() => {
    void source;
    loaded = false;
    failed = false;
  });
</script>

<div bind:clientHeight={height} class="relative flex min-h-0 flex-1 flex-col">
  {#if kind === "image"}
    <ZoomPane class="min-h-0 flex-1" {active}>
      <img
        use:imageSrc={{
          url: source,
          fallback,
          onload: () => (loaded = true),
          onerror: () => (failed = true),
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
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      use:servedSrc={{ url: source }}
      use:posterSrc={{ url: frame ?? "" }}
      controls
      class="min-h-0 flex-1 bg-black"
    ></video>
  {:else if kind === "video"}
    <div class="flex min-h-0 flex-1 items-center justify-center bg-black">
      {#if frame}
        <img use:imageSrc={{ url: frame }} alt="" draggable="false" class="h-full w-full object-contain" />
      {/if}
    </div>
  {:else}
    <EmptyState icon={fileIcon(item.name)} text={item.name} class="flex-1" />
  {/if}
</div>
