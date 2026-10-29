<script lang="ts">
  import type { Snippet } from "svelte";
  import { gridHeight } from "$lib/ui/gridHeight";
  import type { IconSource } from "$lib/ui/icons";
  import { insideCard, provideCardFrame } from "./cards";
  import CollapsibleHead from "./CollapsibleHead.svelte";
  import type { HeadTone } from "./headTones";
  import { provideStickyHeads, stickyHeads } from "./stickyHeads";

  interface Props {
    label: string;
    icon?: IconSource;
    leading?: Snippet<[string]>;
    preview?: string | null;
    stat?: string | null;
    meta?: Snippet;
    labelOnly?: boolean;
    running?: boolean;
    tone?: HeadTone;
    bodyClass?: string;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    children?: Snippet;
  }

  const {
    label,
    icon: IconComponent,
    leading,
    preview = null,
    stat = null,
    meta,
    labelOnly = false,
    running = false,
    tone = "process",
    bodyClass = "pt-1",
    expanded = null,
    onToggle = null,
    children,
  }: Props = $props();

  const sticky = stickyHeads();
  provideStickyHeads(false);

  const nested = insideCard();
  provideCardFrame();

  const headClass = sticky ? "group/head sticky top-0 z-20 bg-card data-[stuck]:shadow-sm" : "";

  let localExpanded = $state(false);

  const isExpanded = $derived(expanded ?? localExpanded);

  const summary = $derived(isExpanded ? "" : (preview ?? "").replace(/\s+/g, " ").trim());

  const toggle = () => {
    if (onToggle) onToggle();
    else localExpanded = !localExpanded;
  };
</script>

<div data-block class="mx-(--page-inset) overflow-clip rounded-panel {nested ? 'bg-surface-nested' : 'bg-card'}">
  <div data-block-head class={headClass}>
    <CollapsibleHead
      {label}
      icon={IconComponent}
      {leading}
      {summary}
      {stat}
      {meta}
      {labelOnly}
      {running}
      {tone}
      expanded={isExpanded}
      onclick={toggle}
    />
  </div>
  {#if isExpanded && children && !labelOnly}
    <div use:gridHeight data-block-body>
      <div
        class="{bodyClass} px-2.5 pb-2.5 [--page-inset:0px] {nested
          ? '[--color-surface-nested:var(--c-surface-variant)]'
          : ''}"
      >
        {@render children()}
      </div>
    </div>
  {/if}
</div>
