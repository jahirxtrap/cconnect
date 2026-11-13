<script lang="ts">
  import Music from "@lucide/svelte/icons/music";
  import { devicePixels, sizedImage } from "$lib/services/imageSize";
  import { imageSrc } from "$lib/services/mediaSource";
  import { audioCoverOf } from "$lib/services/sharedApi";

  interface Props {
    url: string;
    cover?: boolean | null;
    class?: string;
  }

  const { url, cover = true, class: className = "" }: Props = $props();

  let side = $state(0);
  let loadedFor = $state<string | null>(null);
  let failedFor = $state<string | null>(null);

  const served = $derived(cover === null ? undefined : cover ? audioCoverOf(url) : null);
  const source = $derived(served && side ? sizedImage(served, devicePixels(side)) : null);
  const missing = $derived(served === null || (source !== null && failedFor === source));
</script>

<div bind:clientWidth={side} class="relative aspect-square overflow-hidden bg-card {className}">
  {#if missing}
    <div class="flex size-full items-center justify-center bg-accent-soft text-accent">
      <Music class="size-1/3 [&>circle]:fill-current" />
    </div>
  {:else if source}
    {#key source}
      <img
        use:imageSrc={{ url: source, onload: () => (loadedFor = source), onerror: () => (failedFor = source) }}
        alt=""
        draggable="false"
        class="size-full object-cover {loadedFor === source ? '' : 'invisible'}"
      />
    {/key}
  {/if}
</div>
