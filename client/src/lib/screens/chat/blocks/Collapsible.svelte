<script lang="ts">
  import type { Snippet } from "svelte";
  import { gridHeight } from "$lib/ui/gridHeight";
  import type { IconSource } from "$lib/ui/icons";
  import CollapsibleHead from "./CollapsibleHead.svelte";

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

  let localExpanded = $state(false);

  const isExpanded = $derived(expanded ?? localExpanded);

  const summary = $derived(isExpanded ? "" : (preview ?? "").replace(/\s+/g, " ").trim());

  const toggle = () => {
    if (onToggle) onToggle();
    else localExpanded = !localExpanded;
  };
</script>

<div data-block class="w-full px-4">
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
  {#if isExpanded && children && !labelOnly}
    <div use:gridHeight data-block-body class={bodyClass}>{@render children()}</div>
  {/if}
</div>
