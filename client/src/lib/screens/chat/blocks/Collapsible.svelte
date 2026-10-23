<script lang="ts">
  import type { Snippet } from "svelte";
  import { subpixelText } from "$lib/platform";
  import { gridHeight } from "$lib/ui/gridHeight";
  import type { IconSource } from "$lib/ui/icons";
  import { insideCard, provideCardFrame } from "./cards";
  import CollapsibleHead from "./CollapsibleHead.svelte";
  import { provideStickyHeads, stickyHeads } from "./stickyHeads";

  interface Props {
    label: string;
    icon?: IconSource;
    preview?: string | null;
    stat?: string | null;
    meta?: Snippet;
    labelOnly?: boolean;
    running?: boolean;
    iconClass?: string;
    bodyClass?: string;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    children?: Snippet;
  }

  const {
    label,
    icon: IconComponent,
    preview = null,
    stat = null,
    meta,
    labelOnly = false,
    running = false,
    iconClass = "text-accent",
    bodyClass = "pt-1",
    expanded = null,
    onToggle = null,
    children,
  }: Props = $props();

  const sticky = stickyHeads();
  provideStickyHeads(false);

  const nested = insideCard();
  provideCardFrame();

  const layer = subpixelText ? "" : "will-change-transform";

  const headClass = sticky ? `group/head sticky top-0 z-20 bg-card data-[stuck]:shadow-sm ${layer}` : "";

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
      {summary}
      {stat}
      {meta}
      {labelOnly}
      {running}
      {iconClass}
      expanded={isExpanded}
      onclick={toggle}
    />
  </div>
  {#if isExpanded && children && !labelOnly}
    <div use:gridHeight data-block-body>
      <div class="{bodyClass} px-2.5 pb-2.5 [--page-inset:0px]">
        {@render children()}
      </div>
    </div>
  {/if}
</div>
