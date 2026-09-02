<script lang="ts">
  import { flushSync } from "svelte";
  import Menu from "@lucide/svelte/icons/menu";
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
  import { navigation } from "$lib/app/navigation.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { accentAt } from "$lib/design/accents";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { accentVars, theme } from "$lib/design/theme.svelte";
  import type { SessionInfo } from "$lib/data/models";
  import { serverStatus, type CompatNotice } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { terminalTabs } from "$lib/data/terminalTabs.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { COMPACT_WIDTH, layout } from "$lib/platform/layout.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ColorDialog from "$lib/ui/ColorDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import Drawer from "$lib/ui/Drawer.svelte";
  import NoticeCard from "$lib/ui/NoticeCard.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { resizeHandle } from "$lib/ui/resizeHandle";
  import MarkdownActions from "$lib/screens/markdown/MarkdownActions.svelte";
  import MarkdownEditor from "$lib/screens/markdown/MarkdownEditor.svelte";
  import MonitorActions from "$lib/screens/monitor/MonitorActions.svelte";
  import MonitorContent from "$lib/screens/monitor/MonitorContent.svelte";
  import ChatView from "./ChatView.svelte";
  import PaneHeader from "./PaneHeader.svelte";
  import PaneViewMenu from "./PaneViewMenu.svelte";
  import ChatList from "./ChatList.svelte";
  import { panes } from "./panes.svelte";
  import LeftPane from "./LeftPane.svelte";
  import TerminalView from "./TerminalView.svelte";
  import MoveSessionDialog from "./MoveSessionDialog.svelte";
  import OrganizeDialog from "./OrganizeDialog.svelte";
  import TabStrip from "./TabStrip.svelte";
  import { tabs, type PaneRole } from "./tabs.svelte";
  import { drawer } from "./drawer.svelte";

  const chat = $derived(panes.focusedTab ? tabs.stateFor(panes.focusedTab) : tabs.state);
  const shownTab = $derived(layout.mobile ? panes.focusedTab : tabs.active);

  const accentOf = (environmentId: string | null | undefined) => {
    const index = backend.environments.find((item) => item.id === environmentId)?.accentIndex ?? null;
    return accentVars(index === null ? theme.appAccent : accentAt(index));
  };

  const centerAccent = $derived(accentOf(shownTab?.environmentId));
  const leftAccent = $derived(accentOf(panes.focusedTab?.environmentId));
  const rightAccent = $derived(
    accentOf(panes.kind === "chat" ? panes.rightTab?.environmentId : backend.activeId),
  );

  const MIN_SIDE_WIDTH = 280;
  const MAX_PANEL_FRACTION = 0.5;

  const NOTICE_KEYS: Record<CompatNotice, string> = {
    app_outdated: "COMPAT_APP_OUTDATED",
    server_outdated: "COMPAT_SERVER_OUTDATED",
    cli_outdated: "COMPAT_CLI_OUTDATED",
  };

  let expanded = $state(settings.leftExpanded);
  let leftWidth = $state(settings.leftWidth);
  let rightWidth = $state(settings.rightWidth);
  let rightDragging = $state(false);

  const chatFocused = $derived(layout.mobile || panes.focused === "center");

  const terminalCwd = $derived.by(() => {
    const selected = chat.historyProjectKey;
    const project = selected
      ? chatListFor(backend.active)?.projects.find((item) => item.projectKey === selected)
      : null;
    return [backend.active?.directory ?? "", project?.path ?? ""].filter(Boolean);
  });

  let renameTarget = $state<SessionInfo | null>(null);
  let deleteTarget = $state<SessionInfo | null>(null);
  let colorTarget = $state<SessionInfo | null>(null);
  let moveTarget = $state<SessionInfo | null>(null);
  let movePreset = $state<string | null>(null);
  let newCategoryTarget = $state<SessionInfo | null>(null);
  let organizeOpen = $state(false);
  let dismissed = $state<CompatNotice[]>([]);
  let composerHeight = $state(0);

  $effect(() =>
    navigation.intercept(() => {
      if (!terminalTabs.overlayOpen) return false;
      terminalTabs.overlayOpen = false;
      return true;
    }),
  );

  $effect(() => {
    if (layout.mobile || !terminalTabs.overlayOpen) return;
    terminalTabs.overlayOpen = false;
    navigation.popLayer();
  });

  const notices = $derived(serverStatus.notices.filter((notice) => !dismissed.includes(notice)));

  let layoutTab = $state(tabs.activeId);
  const instantLayout = $derived(tabs.activeId !== layoutTab);

  $effect(() => {
    if (!instantLayout) return;
    const id = tabs.activeId;
    requestAnimationFrame(() => requestAnimationFrame(() => (layoutTab = id)));
  });


  $effect(() => {
    layout.bottomInset = composerHeight;
    return () => (layout.bottomInset = 0);
  });

  $effect(() => {
    layout.rightInset = !layout.mobile && panes.open ? rightWidth : 0;
    layout.rightInsetAnimated = !rightDragging;
    return () => (layout.rightInset = 0);
  });

  const focusFrom = (event: PointerEvent, role: PaneRole) => {
    if (layout.mobile) return;
    if ((event.target as HTMLElement | null)?.closest('[role="separator"]')) return;
    flushSync(() => panes.focus(role));
  };

  const swappable = $derived(panes.open && panes.kind === "chat");

  const dragPanes = (pointerX: number, done: boolean, origin: PaneRole) => {
    const overRight = pointerX >= layout.width - rightWidth;
    const target: PaneRole = overRight ? "right" : "center";
    const reached = target !== origin;

    if (!done) {
      panes.dropTarget = reached ? target : null;
      return;
    }

    panes.dropTarget = null;
    if (!reached) return;
    panes.swap();
    panes.commit();
  };

  const transfersLift = $derived(
    Math.max(0, layout.transfersInset - composerHeight - layout.safeBottom),
  );

  $effect(() => {
    const environmentIds = [...new Set(tabs.list.map((tab) => tab.environmentId))];
    for (const id of environmentIds) {
      const sessions = chatListFor(backend.find(id))?.sessions;
      if (sessions?.length) tabs.applyLiveSessions(sessions);
    }
  });

  const setExpanded = (value: boolean) => {
    expanded = value;
    settings.leftExpanded = value;
  };

  useShortcut("panel.left", () => {
    if (layout.mobile) drawer.open = !drawer.open;
    else setExpanded(!expanded);
  });

  useShortcut("panel.right", () => {
    if (layout.mobile) terminalTabs.overlayOpen = !terminalTabs.overlayOpen;
    else panes.setOpen(!panes.open);
  });

  $effect(() => {
    if (!layout.mobile) drawer.open = false;
  });

  $effect(() =>
    navigation.intercept(() => {
      if (!drawer.open) return false;
      drawer.open = false;
      return true;
    }),
  );
</script>

{#if layout.mobile && terminalTabs.overlayOpen}
  <div
    class="safe-area fixed inset-x-0 top-0 z-40 bg-surface"
    style="height: calc(100% - var(--keyboard, 0px))"
  >
    <TerminalView cwd={terminalCwd} onClose={() => navigation.popLayer()} />
  </div>
{/if}

<div class="flex h-full">
  {#if !layout.mobile}
    <LeftPane
      {chat}
      accent={leftAccent}
      {expanded}
      width={leftWidth}
      onExpanded={setExpanded}
      onWidth={(value, committed) => {
        leftWidth = value;
        if (committed) settings.leftWidth = value;
      }}
      onNewTab={(categoryId) => panes.newTab(categoryId)}
      onOpenSession={(session) => panes.openSession(session)}
      onOpenRight={(session) => panes.openInRight(session)}
      onRename={(session) => (renameTarget = session)}
      onColor={(session) => (colorTarget = session)}
      onDelete={(session) => (deleteTarget = session)}
      onMove={(session, preset) => ((movePreset = preset), (moveTarget = session))}
      onNewCategory={(session) => (newCategoryTarget = session)}
      onOrganize={() => (organizeOpen = true)}
    />
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex min-w-0 flex-1 flex-col"
    style={centerAccent}
    data-unfocused={chatFocused ? undefined : true}
    onpointerdowncapture={(event) => focusFrom(event, "center")}
  >
    {#if !layout.mobile}
      <TabStrip
        items={tabs.center}
        activeId={tabs.activeId}
        onSelect={(id) => tabs.select(id)}
        onNew={() => tabs.newTab()}
        newShortcut="tab.new"
        onClose={(id) => panes.close(id)}
        onMove={(id, index) => tabs.move(id, index)}
        onDrop={() => tabs.commit()}
        onPaneDrag={swappable ? (dx, done) => dragPanes(dx, done, "center") : undefined}
        focused={chatFocused}
        trailing={sideToggle}
      />
    {/if}
    {#if shownTab}
      <ChatView
        tab={shownTab}
        primary
        focused={chatFocused}
        switcherCwd={terminalCwd}
        {transfersLift}
        instant={instantLayout}
        navigationIcon={layout.mobile ? menuButton : undefined}
        notices={compatNotices}
        onComposerHeight={(height) => (composerHeight = height)}
      />
    {/if}
    {#if panes.dropTarget === "center"}
      {@render dropHint()}
    {/if}
  </div>

  {#if !layout.mobile}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative h-full shrink-0 overflow-hidden {rightDragging
        ? ''
        : 'transition-[width] duration-200'}"
      style="width: {panes.open ? rightWidth : 0}px; {rightAccent}"
      data-unfocused={panes.focused === "right" ? undefined : true}
      onpointerdowncapture={(event) => focusFrom(event, "right")}
    >
      <div class="relative flex h-full flex-col" style="width: {rightWidth}px">
        <div
          role="separator"
          aria-orientation="vertical"
          class="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize"
          use:resizeHandle={{
            axis: "x",
            invert: true,
            value: () => rightWidth,
            min: MIN_SIDE_WIDTH,
            max: () => layout.width * MAX_PANEL_FRACTION,
            onResize: (value) => (rightWidth = value),
            onDragging: (active) => {
              rightDragging = active;
              if (!active) settings.rightWidth = rightWidth;
            },
          }}
        ></div>
        {#if panes.kind === "chat" && panes.rightTab}
          <div class="flex h-full flex-col border-l border-outline-variant">
            <TabStrip
              items={tabs.right}
              activeId={panes.rightTab?.id ?? null}
              onSelect={(id) => panes.showTab(id)}
              onNew={() => panes.newTab()}
              newShortcut="tab.new"
              onClose={(id) => panes.close(id)}
              onMove={(id, index) => tabs.move(id, index)}
              onDrop={() => tabs.commit()}
              onPaneDrag={(dx, done) => dragPanes(dx, done, "right")}
              focused={panes.focused === "right"}
              trailing={sideActions}
            />
            <ChatView tab={panes.rightTab} focused={panes.focused === "right"} />
          </div>
        {:else if panes.kind === "markdown"}
          <div class="flex h-full flex-col border-l border-outline-variant">
            <PaneHeader title={t("MARKDOWN")} actions={markdownActions} />
            <MarkdownEditor />
          </div>
        {:else if panes.kind === "monitor"}
          <div class="flex h-full flex-col border-l border-outline-variant">
            <PaneHeader title={t("MONITOR")} actions={monitorActions} />
            <MonitorContent compact={rightWidth < COMPACT_WIDTH} />
          </div>
        {:else}
          <TerminalView cwd={terminalCwd} viewMenu={paneViewMenu} onClose={() => panes.setOpen(false)} />
        {/if}
        {#if panes.dropTarget === "right"}
          {@render dropHint()}
        {/if}
      </div>
    </div>
  {/if}
</div>

{#snippet compatNotices()}
  {#if notices.length}
    <div class="absolute right-0 bottom-0 left-0 z-20 flex flex-col gap-1.5 px-3 pb-3">
      {#each notices as notice (notice)}
        <NoticeCard
          text={t(NOTICE_KEYS[notice])}
          actionLabel={t("SETTINGS")}
          onAction={() => {
            dismissed = [...dismissed, notice];
            if (notice !== "cli_outdated") navigation.openSettings("about");
            else if (layout.mobile) navigation.openClaude("cli");
            else navigation.openSettings("cli");
          }}
          onDismiss={() => (dismissed = [...dismissed, notice])}
        />
      {/each}
    </div>
  {/if}
{/snippet}

{#snippet dropHint()}
  <div class="drop-overlay pointer-events-none absolute inset-0 z-40 border-2 border-accent"></div>
{/snippet}

{#snippet paneViewMenu()}
  <PaneViewMenu />
{/snippet}

{#snippet markdownActions()}
  <MarkdownActions compact />
{/snippet}

{#snippet monitorActions()}
  <MonitorActions compact showEnvironment={false} />
{/snippet}

{#snippet sideActions()}
  <PaneViewMenu />
  <TooltipIconButton
    label={t("PANEL_RIGHT")}
    shortcut="panel.right"
    class="size-8"
    onclick={() => panes.setOpen(false)}
  >
    <PanelRightClose />
  </TooltipIconButton>
{/snippet}

{#snippet sideToggle()}
  <div
    inert={panes.open}
    class="overflow-hidden transition-[width,opacity] duration-200 {panes.open
      ? 'w-0 opacity-0'
      : 'w-8 opacity-100'}"
  >
    <TooltipIconButton
      label={t("PANEL_RIGHT")}
      shortcut="panel.right"
      class="size-8"
      onclick={() => panes.setOpen(true)}
    >
      <PanelRightOpen />
    </TooltipIconButton>
  </div>
{/snippet}

{#snippet menuButton()}
  <TooltipIconButton label={t("MENU")} shortcut="panel.left" onclick={() => (drawer.open = true)}>
    <Menu size={20} />
  </TooltipIconButton>
{/snippet}

{#if layout.mobile}
  <Drawer open={drawer.open} onDismiss={() => (drawer.open = false)} onOpen={() => (drawer.open = true)}>
    <ChatList
      {chat}
      onOpenRight={(session) => panes.openInRight(session)}
      drawerMode
      onClose={layout.touch ? null : () => (drawer.open = false)}
      onAfterSelect={() => (drawer.open = false)}
      onNewTab={(categoryId) => panes.newTab(categoryId)}
      onOpenSession={(session) => panes.openSession(session)}
      onRename={(session) => (renameTarget = session)}
      onColor={(session) => (colorTarget = session)}
      onDelete={(session) => (deleteTarget = session)}
      onMove={(session, preset) => ((movePreset = preset), (moveTarget = session))}
      onNewCategory={(session) => (newCategoryTarget = session)}
      onOrganize={() => (organizeOpen = true)}
    />
  </Drawer>
{/if}

{#if renameTarget}
  {@const target = renameTarget}
  <RenameDialog
    initial={target.title ?? target.preview ?? ""}
    onConfirm={(title) => {
      void chat.rename(target, title);
      renameTarget = null;
    }}
    onDismiss={() => (renameTarget = null)}
  />
{/if}

{#if newCategoryTarget}
  {@const target = newCategoryTarget}
  <RenameDialog
    initial=""
    title={t("ADD_CATEGORY")}
    confirmLabel={t("CREATE")}
    onConfirm={(name) => {
      void chat.createCategoryWith(name, target.sessionId);
      newCategoryTarget = null;
    }}
    onDismiss={() => (newCategoryTarget = null)}
  />
{/if}

{#if organizeOpen}
  <OrganizeDialog {chat} onDismiss={() => (organizeOpen = false)} onOpenChat={() => (drawer.open = false)} />
{/if}

{#if moveTarget}
  {@const target = moveTarget}
  <MoveSessionDialog
    session={target}
    projects={chat.historyProjects}
    preset={movePreset}
    onConfirm={(cwd) => {
      void chat.move(target, cwd);
      moveTarget = null;
    }}
    onDismiss={() => (moveTarget = null)}
  />
{/if}

{#if colorTarget}
  {@const target = colorTarget}
  <ColorDialog
    title={t("CONVERSATION_COLOR")}
    options={(chat.capabilities?.colors ?? [])
      .map((name) => ({ value: name, color: sessionColorOf(name) ?? "", label: name }))
      .filter((option) => option.color)}
    selected={target.color}
    onSelect={(color) => void chat.setColor(target, color)}
    onDismiss={() => (colorTarget = null)}
  />
{/if}

{#if deleteTarget}
  {@const target = deleteTarget}
  <ConfirmDialog
    title={t(chat.trashEnabled ? "TRASH" : "DELETE")}
    text={t(
      chat.trashEnabled ? "TRASH_CONVERSATION_CONFIRM" : "DELETE_CONVERSATION_CONFIRM",
      target.title ?? target.preview ?? target.sessionId,
    )}
    confirmLabel={t(chat.trashEnabled ? "CONFIRM" : "DELETE")}
    onConfirm={() => {
      void chat.remove(target);
      deleteTarget = null;
    }}
    onDismiss={() => (deleteTarget = null)}
  />
{/if}
