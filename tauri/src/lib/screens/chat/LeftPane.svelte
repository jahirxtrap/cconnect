<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import Folder from "@lucide/svelte/icons/folder";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import Settings from "@lucide/svelte/icons/settings";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Type from "@lucide/svelte/icons/type";
  import { navigation } from "$lib/app/navigation.svelte";
  import type { SessionInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { resizeHandle } from "$lib/ui/resizeHandle";
  import ChatList from "./ChatList.svelte";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState;
    accent: string;
    expanded: boolean;
    width: number;
    onExpanded: (value: boolean) => void;
    onWidth: (value: number, committed: boolean) => void;
    onNewTab: (categoryId: string | null) => void;
    onOpenSession: (session: SessionInfo) => void;
    onOpenRight: (session: SessionInfo) => void;
    onRename: (session: SessionInfo) => void;
    onColor: (session: SessionInfo) => void;
    onDelete: (session: SessionInfo) => void;
    onMove: (session: SessionInfo, preset: string | null) => void;
    onNewCategory: (session: SessionInfo) => void;
    onOrganize: () => void;
  }

  const {
    chat,
    accent,
    expanded,
    width,
    onExpanded,
    onWidth,
    onNewTab,
    onOpenSession,
    onOpenRight,
    onRename,
    onColor,
    onDelete,
    onMove,
    onNewCategory,
    onOrganize,
  }: Props = $props();

  const RAIL_WIDTH = 64;
  const MIN_WIDTH = 220;
  const MAX_FRACTION = 0.5;

  let dragging = $state(false);
</script>

<div
  class="relative h-full shrink-0 overflow-hidden bg-surface {dragging
    ? ''
    : 'transition-[width] duration-200'}"
  style="width: {expanded ? width : RAIL_WIDTH}px; {accent}"
>
  {#if expanded}
    <ChatList
      {chat}
      drawerMode={false}
      onClose={() => onExpanded(false)}
      onAfterSelect={() => {}}
      {onNewTab}
      {onOpenSession}
      {onOpenRight}
      {onRename}
      {onColor}
      {onDelete}
      {onMove}
      {onNewCategory}
      {onOrganize}
    />
    <div
      role="separator"
      aria-orientation="vertical"
      class="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize"
      use:resizeHandle={{
        axis: "x",
        value: () => width,
        min: MIN_WIDTH,
        max: () => layout.width * MAX_FRACTION,
        onResize: (value) => onWidth(value, false),
        onDragging: (active) => {
          dragging = active;
          if (!active) onWidth(width, true);
        },
      }}
    ></div>
  {:else}
    <div class="flex h-full flex-col items-center border-r border-outline-variant py-2">
      <TooltipIconButton label={t("MENU")} shortcut="panel.left" onclick={() => onExpanded(true)}>
        <PanelLeftOpen size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("NEW_SESSION")} onclick={() => chat.newSession()}>
        <SquarePen size={20} />
      </TooltipIconButton>
      <div class="flex-1"></div>
      <TooltipIconButton label={t("FILES")} onclick={() => navigation.openExplorer()}>
        <Folder size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("CLAUDE")} onclick={() => navigation.navigate("/claude")}>
        <ClaudeIcon size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("MONITOR")} onclick={() => navigation.navigate("/monitor")}>
        <Activity size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("TERMINAL")} onclick={() => navigation.navigate("/terminal")}>
        <SquareTerminal size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("MARKDOWN")} onclick={() => navigation.navigate("/markdown")}>
        <Type size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("SETTINGS")} onclick={() => navigation.openSettings()}>
        <Settings size={20} />
      </TooltipIconButton>
    </div>
  {/if}
</div>
