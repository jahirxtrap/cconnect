<script lang="ts" module>
  export const TITLE_CLASS = "truncate text-title-md";
  export const SUBTITLE_CLASS = "truncate text-topbar-subtitle text-on-surface-variant";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import StatusDot from "./StatusDot.svelte";

  interface Props {
    title: string;
    subtitle?: string | null;
    server?: boolean;
    class?: string;
    contained?: boolean;
    navigationIcon?: Snippet;
    subtitleLeading?: Snippet;
    controls?: Snippet;
    actions?: Snippet;
    deficit?: number;
  }

  let {
    title,
    subtitle,
    server = false,
    class: className = "",
    contained = false,
    navigationIcon,
    subtitleLeading,
    controls,
    actions,
    deficit = $bindable(0),
  }: Props = $props();

  let heading = $state<HTMLElement | null>(null);
  let strip = $state<HTMLElement | null>(null);

  const line = $derived(
    server ? (serverStatus.unavailable ? t("SERVER_UNAVAILABLE") : (backend.active?.name ?? null)) : subtitle,
  );

  const overflow = (node: HTMLElement) => Math.max(0, node.scrollWidth - node.clientWidth);

  $effect(() => {
    const label = heading;
    const row = strip;
    if (!label || !row) return;
    const measure = () => (deficit = overflow(label) + overflow(row));
    const resize = new ResizeObserver(measure);
    const watch = () => {
      resize.disconnect();
      resize.observe(label);
      resize.observe(row);
      for (const child of row.children) resize.observe(child);
    };
    const mutation = new MutationObserver(watch);
    mutation.observe(row, { childList: true });
    watch();
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  });
</script>

{#snippet serverDot()}
  <StatusDot
    class={serverStatus.unavailable ? "bg-red" : "bg-green"}
    loading={serverStatus.checking && !serverStatus.online}
  />
{/snippet}

<header class="flex h-12 shrink-0 items-center pr-2 {navigationIcon ? 'pl-2' : 'pl-(--page-inset)'} {className}">
  <div class="flex min-w-0 flex-1 items-center gap-1 {contained ? 'mx-auto max-w-3xl' : ''}">
    {@render navigationIcon?.()}
    <div class="min-w-0 shrink">
      <p bind:this={heading} class={TITLE_CLASS}>{title}</p>
      {#if line}
        <div class="flex min-w-0 items-center gap-1.5">
          {@render (server ? serverDot : subtitleLeading)?.()}
          <p class={SUBTITLE_CLASS}>{line}</p>
        </div>
      {/if}
    </div>
    <div class="min-w-0 flex-1"></div>
    {#if controls || actions}
      <div class="flex min-w-0 items-center gap-2">
        {#if controls}
          <div bind:this={strip} class="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto">
            {@render controls()}
          </div>
        {/if}
        {#if actions}
          <div class="flex shrink-0 items-center">{@render actions()}</div>
        {/if}
      </div>
    {/if}
  </div>
</header>
