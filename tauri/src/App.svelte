<script lang="ts">
  import { navigation } from "$lib/app/navigation.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { desktop } from "$lib/platform/desktop.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { notifier } from "$lib/services/notifier.svelte";
  import ChatScreen from "$lib/screens/chat/ChatScreen.svelte";
  import FilePreview from "$lib/screens/files/FilePreview.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import ClaudeScreen from "$lib/screens/claude/ClaudeScreen.svelte";
  import FileExplorerScreen from "$lib/screens/files/FileExplorerScreen.svelte";
  import MarkdownScreen from "$lib/screens/markdown/MarkdownScreen.svelte";
  import MonitorScreen from "$lib/screens/monitor/MonitorScreen.svelte";
  import SettingsScreen from "$lib/screens/settings/SettingsScreen.svelte";
  import TerminalScreen from "$lib/screens/terminal/TerminalScreen.svelte";
  import TransfersPanel from "$lib/ui/TransfersPanel.svelte";

  theme.start();
  layout.start();
  navigation.start();
  tabs.start();
  serverStatus.start();
  notifier.start((tabId) => {
    if (tabId) tabs.select(tabId);
  });
  void desktop.start();

  const onKeydown = (event: KeyboardEvent) => {
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
    const key = event.key.toLowerCase();
    const handled =
      control && key === "tab"
        ? (event.shiftKey ? tabs.selectPrev() : tabs.selectNext(), true)
        : control && key === "t"
          ? (tabs.newTab(), true)
          : control && key === "w"
            ? (tabs.closeActive(), true)
            : event.altKey && event.key === "ArrowRight"
              ? (tabs.selectNext(), true)
              : event.altKey && event.key === "ArrowLeft"
                ? (tabs.selectPrev(), true)
                : false;
    if (handled) event.preventDefault();
  };

  const blockFileOpen = (event: DragEvent) => event.preventDefault();

  $effect(() => {
    theme.environmentAccent = backend.active?.accentIndex ?? null;
  });
</script>

<svelte:window onkeydown={onKeydown} ondragover={blockFileOpen} ondrop={blockFileOpen} />

<div
  class="safe-area bg-background text-on-background"
  style="height: calc(100% - var(--keyboard, 0px))"
>
  {#if navigation.route === "/settings"}
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

<TransfersPanel />

{#if navigation.preview}
  {@const request = navigation.preview}
  <FilePreview
    url={request.url}
    filename={request.name}
    onDelete={request.onDelete}
    onClose={() => navigation.closePreview()}
  />
{/if}
