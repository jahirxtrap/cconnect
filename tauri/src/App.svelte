<script lang="ts">
  import { dismissOpen } from "$lib/app/dismissStack";
  import { navigation } from "$lib/app/navigation.svelte";
  import { isEditing, paneFocus } from "$lib/data/paneFocus.svelte";
  import { serverDefaults } from "$lib/data/serverDefaults.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { desktop } from "$lib/platform/desktop.svelte";
  import { mirrorNativeCopy } from "$lib/platform/clipboard";
  import { layout } from "$lib/platform/layout.svelte";
  import { shortcuts, type ShortcutScope } from "$lib/platform/shortcuts.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { notifier } from "$lib/services/notifier.svelte";
  import { updater } from "$lib/services/updater.svelte";
  import ChatScreen from "$lib/screens/chat/ChatScreen.svelte";
  import FilePreview from "$lib/screens/files/FilePreview.svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import ClaudeScreen from "$lib/screens/claude/ClaudeScreen.svelte";
  import FileExplorerScreen from "$lib/screens/files/FileExplorerScreen.svelte";
  import MarkdownScreen from "$lib/screens/markdown/MarkdownScreen.svelte";
  import MonitorScreen from "$lib/screens/monitor/MonitorScreen.svelte";
  import { monitor } from "$lib/screens/monitor/monitor.svelte";
  import SettingsDialog from "$lib/screens/settings/SettingsDialog.svelte";
  import SettingsScreen from "$lib/screens/settings/SettingsScreen.svelte";
  import TerminalScreen from "$lib/screens/terminal/TerminalScreen.svelte";
  import TransfersPanel from "$lib/ui/TransfersPanel.svelte";
  import QrCameraOverlay from "$lib/ui/QrCameraOverlay.svelte";
  import { hasFiles } from "$lib/ui/fileDrop";
  import { refreshPixelGrid } from "$lib/ui/pixelGrid";

  refreshPixelGrid();
  theme.start();
  layout.start();
  navigation.start();
  tabs.start();
  serverStatus.start();
  void updater.consumeIfInstalled();
  notifier.start((tabId) => {
    if (tabId) panes.reveal(tabId);
  });
  void desktop.start();

  useShortcut("tab.new", () => void panes.newTab());
  useShortcut("tab.close", () => panes.closeFocused());
  useShortcut("tab.next", () => panes.selectSibling(1));
  useShortcut("tab.previous", () => panes.selectSibling(-1));
  useShortcut("tab.moveNext", () => panes.moveFocused(1));
  useShortcut("tab.movePrevious", () => panes.moveFocused(-1));
  useShortcut("window.fullscreen", () => void desktop.toggleFullscreen());
  useShortcut("window.refresh", () => {
    desktop.refreshTick++;
  });

  const settingsAsDialog = $derived(!layout.mobile);

  const scopeChain = (): ShortcutScope[] => {
    if (dismissOpen()) return ["global"];
    if (navigation.route === "/files") return ["files", "global"];
    if (navigation.route === "/terminal") return ["terminal", "global"];
    if (navigation.route === "/") return [paneFocus.active, "global"];
    return ["global"];
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      if (navigation.close()) {
        event.preventDefault();
        return;
      }
      if (navigation.route !== "/") navigation.back();
      return;
    }
    const control = event.ctrlKey || event.metaKey;
    if (!control && !event.altKey && event.key.length === 1 && !isEditing()) {
      paneFocus.focusActive();
      return;
    }
    if (!control && !event.altKey && isEditing()) return;
    if (shortcuts.handle(event, scopeChain())) event.preventDefault();
  };

  const blockFileOpen = (event: DragEvent) => {
    if (hasFiles(event)) event.preventDefault();
  };

  $effect(() => {
    theme.environmentAccent = backend.active?.accentIndex ?? null;
  });

  $effect(() => {
    void backend.activeId;
    monitor.setActive(
      navigation.route === "/monitor" || (panes.open && panes.kind === "monitor" && !layout.mobile),
    );
  });

  $effect(() => {
    void navigation.route;
    getSelection()?.removeAllRanges();
  });

  $effect(() => {
    if (serverDefaults.revision > 0) tabs.refreshDefaults();
  });
</script>

<svelte:window
  onkeydown={onKeydown}
  oncopy={mirrorNativeCopy}
  oncut={mirrorNativeCopy}
  ondragover={blockFileOpen}
  ondrop={blockFileOpen}
  onresize={() => refreshPixelGrid()}
/>

<div
  class="safe-area bg-background text-on-background"
  style="height: calc(100% - var(--keyboard, 0px))"
>
  {#if navigation.route === "/settings" && !settingsAsDialog}
    <SettingsScreen />
  {:else if navigation.route === "/monitor"}
    <MonitorScreen />
  {:else if navigation.route === "/markdown"}
    <MarkdownScreen />
  {:else if navigation.route === "/claude"}
    <ClaudeScreen />
  {:else if navigation.route === "/files"}
    <FileExplorerScreen />
  {:else if navigation.route === "/terminal"}
    <TerminalScreen />
  {:else}
    <ChatScreen />
  {/if}
</div>

{#if navigation.route === "/settings" && settingsAsDialog}
  <SettingsDialog onDismiss={() => navigation.navigate("/")} />
{/if}

<TransfersPanel />

<QrCameraOverlay />

{#if navigation.preview}
  {@const request = navigation.preview}
  <FilePreview
    url={request.url}
    filename={request.name}
    onDelete={request.onDelete}
    onClose={() => navigation.closePreview()}
  />
{/if}
