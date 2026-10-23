<script lang="ts">
  import type { Snippet } from "svelte";
  import { subpixelText } from "$lib/platform";
  import { gridHeight } from "$lib/ui/gridHeight";
  import type { IconSource } from "$lib/ui/icons";
  import CollapsibleHead from "./CollapsibleHead.svelte";
  import { provideStickyHeads, stickyHeads } from "./stickyHeads";

  interface Props {
    label: string;
    icon?: IconSource;
    preview?: string | null;
    stat?: string | null;
    labelOnly?: boolean;
    running?: boolean;
    labelClass?: string;
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
    labelOnly = false,
    running = false,
    labelClass = "text-on-surface-variant",
    iconClass = "text-accent",
    bodyClass = "pt-1",
    expanded = null,
    onToggle = null,
    children,
  }: Props = $props();

  const sticky = stickyHeads();
  provideStickyHeads(false);

  let localExpanded = $state(false);

  const isExpanded = $derived(expanded ?? localExpanded);

  const summary = $derived(isExpanded ? "" : (preview ?? "").replace(/\s+/g, " ").trim());

  const toggle = () => {
    if (onToggle) onToggle();
    else localExpanded = !localExpanded;
  };
</script>

<div data-block class="w-full px-4">
  <div
    data-block-head
    class={sticky
      ? `group/head sticky top-0 z-20 -mx-4 bg-background px-4 data-[stuck]:px-0 data-[stuck]:shadow-sm ${subpixelText ? "" : "will-change-transform"}`
      : ""}
  >
    <CollapsibleHead
      {label}
      icon={IconComponent}
      {summary}
      {stat}
      {labelOnly}
      {running}
      {labelClass}
      {iconClass}
      expanded={isExpanded}
      onclick={toggle}
    />
  </div>
  {#if isExpanded && children && !labelOnly}
    <div use:gridHeight data-block-body class={bodyClass}>{@render children()}</div>
  {/if}
</div>
