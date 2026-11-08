<script lang="ts" module>
  export const TITLE_CLASS = "truncate text-title-md";
  const SUBTITLE_TYPE = "truncate text-topbar-subtitle";
  export const SUBTITLE_CLASS = `${SUBTITLE_TYPE} text-on-surface-variant`;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { CopyFeedback } from "./copyFeedback.svelte";
  import { LINK_LOOKS } from "./linkStatus";
  import { PRESS_FADE_MS } from "./press";
  import { SCROLL_ROW_CLASS } from "./scrollbar";
  import StatusDot from "./StatusDot.svelte";

  interface Props {
    title: string;
    subtitle?: string | null;
    subtitleCopy?: { label: string; value: string } | null;
    server?: boolean;
    class?: string;
    contained?: boolean;
    navigationIcon?: Snippet;
    subtitleLeading?: Snippet;
    search?: Snippet;
    controls?: Snippet;
    actions?: Snippet;
    deficit?: number;
  }

  let {
    title,
    subtitle,
    subtitleCopy = null,
    server = false,
    class: className = "",
    contained = false,
    navigationIcon,
    subtitleLeading,
    search,
    controls,
    actions,
    deficit = $bindable(0),
  }: Props = $props();

  let heading = $state<HTMLElement | null>(null);
  let strip = $state<HTMLElement | null>(null);

  const feedback = new CopyFeedback();

  const look = $derived(serverStatus.link === "connected" ? null : LINK_LOOKS[serverStatus.link]);

  const line = $derived(server ? (look ? t(look.text) : (backend.active?.name ?? null)) : subtitle);

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
  <StatusDot class={look?.dot ?? "bg-green"} loading={look?.spinner ?? false} />
{/snippet}

<header class="flex h-12 shrink-0 items-center pr-2 {navigationIcon ? 'pl-2' : 'pl-(--page-inset)'} {className}">
  <div class="flex min-w-0 flex-1 items-center gap-1 {contained ? 'mx-auto max-w-3xl' : ''}">
    {@render navigationIcon?.()}
    <div class="min-w-0 shrink">
      <p bind:this={heading} class={TITLE_CLASS}>{title}</p>
      {#if line}
        <div class="group/status flex min-w-0 items-center gap-1.5">
          {@render (server ? serverDot : subtitleLeading)?.()}
          {#if subtitleCopy}
            {@const id = subtitleCopy}
            <button
              type="button"
              title={t("COPY")}
              data-press="off"
              onclick={() => feedback.copy(id.value)}
              style="transition-duration: {PRESS_FADE_MS}ms"
              class="{SUBTITLE_TYPE} min-w-0 cursor-pointer text-left transition-colors {feedback.copied
                ? 'text-on-surface'
                : 'text-on-surface-variant'}"
            >
              <span class={feedback.copied ? "hidden" : "group-hover/status:hidden group-active/status:hidden"}>{line}</span>
              <span class={feedback.copied ? "" : "hidden group-hover/status:inline group-active/status:inline"}>{id.label}</span>
            </button>
          {:else}
            <p class={SUBTITLE_CLASS}>{line}</p>
          {/if}
        </div>
      {/if}
    </div>
    <div class="min-w-0 flex-1"></div>
    {#if search || controls || actions}
      <div class="flex min-w-0 items-center gap-2">
        {@render search?.()}
        {#if controls}
          <div bind:this={strip} class="{SCROLL_ROW_CLASS} flex min-w-0 items-center gap-2">
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
