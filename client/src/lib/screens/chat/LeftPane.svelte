<script lang="ts" module>
  export const RAIL_WIDTH = 64;
  export const LEFT_MIN_WIDTH = 220;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import ScreenBar from "$lib/app/ScreenBar.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { resizeHandle } from "$lib/ui/resizeHandle";

  interface Props {
    accent: string;
    expanded: boolean;
    width: number;
    max: number;
    onExpanded: (value: boolean) => void;
    resizing: boolean;
    onWidth: (value: number) => void;
    onDragging: (active: boolean) => void;
    onNewChat: () => void;
    children: Snippet;
  }

  const { accent, expanded, width, max, onExpanded, resizing, onWidth, onDragging, onNewChat, children }: Props =
    $props();
</script>

<div
  class="relative h-full shrink-0 overflow-hidden bg-surface {resizing
    ? ''
    : 'transition-[width] duration-200'}"
  style="width: {expanded ? width : RAIL_WIDTH}px; {accent}"
>
  {#if expanded}
    {@render children()}
    <div
      role="separator"
      aria-orientation="vertical"
      class="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize"
      use:resizeHandle={{
        axis: "x",
        value: () => width,
        min: LEFT_MIN_WIDTH,
        max: () => max,
        onResize: onWidth,
        onDragging,
      }}
    ></div>
  {:else}
    <div class="flex h-full flex-col items-center pt-2.5 pb-2">
      <TooltipIconButton label={t("MENU")} shortcut="panel.left" onclick={() => onExpanded(true)}>
        <PanelLeftOpen />
      </TooltipIconButton>
      <TooltipIconButton label={t("NEW_CHAT")} onclick={onNewChat}>
        <SquarePen />
      </TooltipIconButton>
      <div class="flex-1"></div>
      <ScreenBar vertical />
    </div>
  {/if}
</div>
