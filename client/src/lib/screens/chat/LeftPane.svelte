<script lang="ts" module>
  export const RAIL_WIDTH = 64;
  export const LEFT_MIN_WIDTH = 220;
</script>

<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import FolderSymlink from "@lucide/svelte/icons/folder-symlink";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import Settings from "@lucide/svelte/icons/settings";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import NotepadText from "@lucide/svelte/icons/notepad-text";
  import { navigation } from "$lib/app/navigation.svelte";
  import type { SessionInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
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
    max: number;
    onExpanded: (value: boolean) => void;
    resizing: boolean;
    onWidth: (value: number) => void;
    onDragging: (active: boolean) => void;
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
    max,
    onExpanded,
    resizing,
    onWidth,
    onDragging,
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
</script>

<div
  class="relative h-full shrink-0 overflow-hidden bg-surface {resizing
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
        min: LEFT_MIN_WIDTH,
        max: () => max,
        onResize: onWidth,
        onDragging,
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
      <TooltipIconButton label={t("SHARED")} onclick={() => navigation.openShared()}>
        <FolderSymlink size={20} />
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
      <TooltipIconButton label={t("NOTES")} onclick={() => navigation.navigate("/notes")}>
        <NotepadText size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("SETTINGS")} onclick={() => navigation.openSettings()}>
        <Settings size={20} />
      </TooltipIconButton>
    </div>
  {/if}
</div>
