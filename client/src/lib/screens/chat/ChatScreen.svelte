<script lang="ts">
  import { flushSync } from "svelte";
  import Menu from "@lucide/svelte/icons/menu";
  import { closeFilePreview, expandFilePreview } from "$lib/app/filePreview";
  import { navigation } from "$lib/app/navigation.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { accentAt } from "$lib/design/accents";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { accentVars, theme } from "$lib/design/theme.svelte";
  import type { SessionInfo } from "$lib/data/models";
  import { serverStatus, type CompatNotice } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ColorDialog from "$lib/ui/ColorDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import Drawer from "$lib/ui/Drawer.svelte";
  import NoticeCard from "$lib/ui/NoticeCard.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { resizeHandle } from "$lib/ui/resizeHandle";
  import ProjectDiffView from "$lib/screens/project/ProjectDiffView.svelte";
  import { closeProjectFile, opened } from "$lib/screens/project/openFile.svelte";
  import FilePreview from "$lib/screens/shared/FilePreview.svelte";
  import ChatView from "./ChatView.svelte";
  import PaneActions from "./PaneActions.svelte";
  import PaneContent from "./PaneContent.svelte";
  import PaneSurface from "./PaneSurface.svelte";
  import ChatList from "./ChatList.svelte";
  import { panes } from "./panes.svelte";
  import LeftPane from "./LeftPane.svelte";
  import MoveSessionDialog from "./MoveSessionDialog.svelte";
  import OrganizeDialog from "./OrganizeDialog.svelte";
  import TabStrip from "./TabStrip.svelte";
  import { tabs, type PaneRole } from "./tabs.svelte";
  import { drawer } from "./drawer.svelte";

  const chat = $derived(panes.focusedTab ? tabs.stateFor(panes.focusedTab) : tabs.state);
  const paneLayer = $derived(layout.mobile && panes.showingTool);
  const shownTab = $derived(layout.mobile && !paneLayer ? panes.focusedTab : tabs.active);

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
    unauthorized: "COMPAT_UNAUTHORIZED",
  };

  let expanded = $state(settings.leftExpanded);
  let leftWidth = $state(settings.leftWidth);
  let rightWidth = $state(settings.rightWidth);
  let rightDragging = $state(false);

  const centerView = $derived(panes.centerView && !layout.mobile);
  const centerPreview = $derived(centerView && panes.previewing);
  const centerDiff = $derived(centerView && !panes.previewing);
  const centerFocused = $derived(layout.mobile ? !paneLayer : panes.focused === "center");
  const chatFocused = $derived(centerFocused && !panes.centerBusy);

  const terminalCwd = $derived.by(() => {
    const selected = chat.historyProject;
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
      if (!navigation.chatActive || !paneLayer) return false;
      panes.setOpen(false);
      return true;
    }),
  );

  $effect(() => {
    navigation.routeLocked =
      navigation.chatActive && !layout.mobile && panes.open && panes.focused === "right";
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
    layout.bottomInset = panes.centerBusy ? 0 : composerHeight;
    return () => (layout.bottomInset = 0);
  });

  $effect(() => {
    layout.rightInset = navigation.chatActive && !layout.mobile && panes.open ? rightWidth : 0;
    layout.rightInsetAnimated = !rightDragging;
    return () => (layout.rightInset = 0);
  });

  const focusFrom = (event: PointerEvent, role: PaneRole) => {
    if (layout.mobile) return;
    if ((event.target as HTMLElement | null)?.closest('[role="separator"]')) return;
    flushSync(() => panes.focus(role));
  };

  const swappable = $derived(panes.open && panes.kind === "chat");

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !panes.previewing) return false;
      closeFilePreview();
      return true;
    }),
  );

  const paneAt = (pointerX: number): PaneRole =>
    pointerX >= layout.width - rightWidth ? "right" : "center";

  const dragPanes = (pointerX: number, done: boolean, origin: PaneRole) => {
    const target = paneAt(pointerX);
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

  const dragTab = (id: string, pointerX: number) => {
    const target = paneAt(pointerX);
    if (tabs.list.find((tab) => tab.id === id)?.pane === target) return false;
    panes.moveToPane(id, target);
    return true;
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

  useShortcut("panel.right", () => panes.setOpen(!panes.open));

  useShortcut("panel.view", () => {
    if (layout.mobile) return false;
    panes.showCenterView(!panes.centerView);
  });

  $effect(() => {
    if (!layout.mobile) drawer.open = false;
  });

  $effect(() => panes.adoptLayout(layout.mobile));

  $effect(() =>
    navigation.intercept(() => {
      if (!drawer.showing) return false;
      drawer.open = false;
      return true;
    }),
  );
</script>

{#if paneLayer}
  <div
    class="safe-area fixed inset-x-0 top-0 z-40 bg-surface"
    style="height: calc(100% - var(--keyboard, 0px)); {rightAccent}"
  >
    <PaneContent instant={instantLayout} centerView={false} {terminalCwd} />
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
    data-unfocused={centerFocused ? undefined : true}
    onpointerdowncapture={(event) => focusFrom(event, "center")}
  >
    {#if !layout.mobile && !panes.centerBusy}
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
        onTabDrag={swappable ? dragTab : undefined}
        group="chat"
        focused={chatFocused}
        trailing={centerActions}
      />
    {/if}
    {#if centerPreview && navigation.preview}
      {@const request = navigation.preview}
      <PaneSurface role="center">
        <FilePreview
          embedded
          url={request.url}
          filename={request.name}
          forcedKind={request.kind}
          onDelete={request.onDelete}
          onClose={closeFilePreview}
          onExpand={expandFilePreview}
        />
      </PaneSurface>
    {:else if centerDiff && opened.project && opened.path}
      {@const project = chatListFor(backend.active)?.projects.find(
        (item) => item.projectKey === opened.project,
      )}
      <PaneSurface role="center">
        <ProjectDiffView
          projectKey={opened.project}
          path={opened.path}
          status={opened.status}
          root={project?.path ?? null}
          embedded={!opened.full}
          onExpand={opened.full ? null : () => (opened.full = true)}
          onClose={closeProjectFile}
        />
      </PaneSurface>
    {:else if shownTab}
      <ChatView
        tab={shownTab}
        primary
        focused={chatFocused}
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
          class="absolute inset-y-0 left-0 z-30 w-1 cursor-col-resize"
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
        <PaneContent
          instant={instantLayout}
          {centerView}
          {terminalCwd}
          onPaneDrag={(dx, done) => dragPanes(dx, done, "right")}
          onTabDrag={dragTab}
        />
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
            if (notice === "unauthorized") navigation.openSettings("environments");
            else if (notice === "server_outdated") navigation.openSettings("server");
            else if (notice !== "cli_outdated") navigation.openSettings("about");
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

{#snippet centerActions()}
  <PaneActions role="center" />
{/snippet}

{#snippet menuButton()}
  <TooltipIconButton label={t("MENU")} shortcut="panel.left" onclick={() => (drawer.open = true)}>
    <Menu size={20} />
  </TooltipIconButton>
{/snippet}

{#if layout.mobile}
  <Drawer
    open={drawer.showing}
    onDismiss={() => (drawer.open = false)}
    onOpen={paneLayer ? null : () => (drawer.open = true)}
  >
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
