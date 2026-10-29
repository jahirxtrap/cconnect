<script lang="ts">
  import { dismissOpen } from "$lib/app/dismissStack";
  import { activeScope } from "$lib/app/activeScope.svelte";
  import CommandPalette from "$lib/app/CommandPalette.svelte";
  import { commandPalette } from "$lib/app/paletteState.svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import RouteScreen from "$lib/app/RouteScreen.svelte";
  import { isEditing, paneFocus } from "$lib/data/paneFocus.svelte";
  import { serverDefaults } from "$lib/data/serverDefaults.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { restorePacks } from "$lib/design/packs/library";
  import { publishNotificationTitles } from "$lib/platform/androidNotify";
  import { listenNativeFiles } from "$lib/platform/pastedContent";
  import { desktop } from "$lib/platform/desktop.svelte";
  import { watchPresence } from "$lib/platform/discordPresence.svelte";
  import { mirrorNativeCopy } from "$lib/platform/clipboard";
  import { layout } from "$lib/platform/layout.svelte";
  import { shortcuts, type ShortcutScope } from "$lib/platform/shortcuts.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { notifier } from "$lib/services/notifier.svelte";
  import { updater } from "$lib/services/updater.svelte";
  import { agentTabs } from "$lib/screens/agents/agentTabs.svelte";
  import ChatScreen from "$lib/screens/chat/ChatScreen.svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { monitor } from "$lib/screens/monitor/monitor.svelte";
  import PackOfferDialog from "$lib/screens/packs/PackOfferDialog.svelte";
  import { takePacks } from "$lib/screens/packs/packIntake";
  import { packOffers } from "$lib/screens/packs/packOffers.svelte";
  import FilePreview from "$lib/screens/shared/FilePreview.svelte";
  import TransfersPanel from "$lib/ui/TransfersPanel.svelte";
  import QrCameraOverlay from "$lib/ui/QrCameraOverlay.svelte";
  import { hasFiles } from "$lib/ui/fileDrop";

  theme.start();
  listenNativeFiles(takePacks);
  void restorePacks();
  layout.start();
  navigation.start();
  tabs.start();
  serverStatus.start();
  void updater.consumeIfInstalled();
  notifier.start(
    (chat) => {
      const agentTab = chat.agent ? agentTabs.tabOf(chat) : null;
      if (agentTab) {
        agentTabs.select(agentTab.pane, agentTab.id);
        panes.setView(agentTab.pane, "agents");
      } else if (chat.tabId) {
        panes.reveal(chat.tabId);
      }
    },
    (session, environmentId) => panes.revealSession(session, environmentId),
  );
  $effect(() => publishNotificationTitles());
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
  useShortcut("window.commands", () => {
    if (layout.mobile) return false;
    commandPalette.open = !commandPalette.open;
  });

  const screenCovers = $derived(!navigation.chatActive && !navigation.centered);

  const scopeChain = (): ShortcutScope[] => {
    if (dismissOpen()) return ["global"];
    const scope = activeScope();
    return scope === "global" ? ["global"] : [scope, "global"];
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
    theme.environmentAccent = backend.active?.accent ?? null;
  });

  $effect(() => {
    void backend.activeId;
    monitor.setActive(
      navigation.route === "/monitor" || panes.shows("monitor"),
    );
  });

  $effect(() => {
    void navigation.route;
    getSelection()?.removeAllRanges();
  });

  $effect(() => {
    if (serverDefaults.revision > 0) tabs.refreshDefaults();
  });

  watchPresence();
</script>

<svelte:window
  onkeydown={onKeydown}
  oncopy={mirrorNativeCopy}
  oncut={mirrorNativeCopy}
  ondragover={blockFileOpen}
  ondrop={blockFileOpen}
/>

<div
  class="safe-area bg-background text-on-background"
  style="height: calc(100% - var(--keyboard, 0px))"
>
  <div class="h-full {screenCovers ? "hidden" : ""}" inert={screenCovers}>
    <ChatScreen />
  </div>
  {#if screenCovers}
    <RouteScreen />
  {/if}
</div>

{#if commandPalette.open}
  <CommandPalette onDismiss={() => (commandPalette.open = false)} />
{/if}

<TransfersPanel />

<QrCameraOverlay />

{#if packOffers.current}
  {#key packOffers.current.id}
    <PackOfferDialog offer={packOffers.current} onDismiss={() => packOffers.dismiss()} />
  {/key}
{/if}

{#if navigation.previewOverlay && navigation.preview}
  {@const request = navigation.preview}
  <FilePreview
    url={request.url}
    filename={request.name}
    forcedKind={request.kind}
    onDelete={request.onDelete}
    onClose={() => navigation.closePreview()}
  />
{/if}
