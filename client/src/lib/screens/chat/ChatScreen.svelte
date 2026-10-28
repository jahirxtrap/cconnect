<script lang="ts">
  import { flushSync } from "svelte";
  import Menu from "@lucide/svelte/icons/menu";
  import { closeFilePreview, expandFilePreview } from "$lib/app/filePreview";
  import { navigation } from "$lib/app/navigation.svelte";
  import RouteScreen from "$lib/app/RouteScreen.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { sessionColorOptions } from "$lib/design/sessionColors";
  import { accentVars, theme } from "$lib/design/theme.svelte";
  import type { SessionInfo } from "$lib/data/models";
  import { serverStatus, type CompatNotice } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { useAgents } from "$lib/services/agents.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ColorDialog from "$lib/ui/ColorDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import Drawer from "$lib/ui/Drawer.svelte";
  import { DROP_BORDER_CLASS } from "$lib/ui/fileDrop";
  import NoticeCard from "$lib/ui/NoticeCard.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { resizeHandle } from "$lib/ui/resizeHandle";
  import { settling } from "$lib/ui/settling.svelte";
  import ProjectDiffView from "$lib/screens/project/ProjectDiffView.svelte";
  import { closeProjectFile, opened } from "$lib/screens/project/openFile.svelte";
  import FilePreview from "$lib/screens/shared/FilePreview.svelte";
  import ChatView from "./ChatView.svelte";
  import PaneActions from "./PaneActions.svelte";
  import { PANE_CARD_CLASS } from "./paneChrome";
  import PaneContent from "./PaneContent.svelte";
  import PaneSurface from "./PaneSurface.svelte";
  import ChatList from "./ChatList.svelte";
  import { panes } from "./panes.svelte";
  import LeftPane, { LEFT_MIN_WIDTH, RAIL_WIDTH } from "./LeftPane.svelte";
  import MoveSessionDialog from "./MoveSessionDialog.svelte";
  import OrganizeDialog from "./OrganizeDialog.svelte";
  import TabStrip from "./TabStrip.svelte";
  import { tabs, type PaneRole } from "./tabs.svelte";
  import { drawer } from "./drawer.svelte";

  useAgents();

  const chat = $derived(panes.focusedChat);
  const paneLayer = $derived(layout.mobile && panes.showingTool);
  let paneOpened = $state(false);
  const paneKept = $derived(paneOpened && layout.mobile && panes.kind !== "chat");
  const shownTab = $derived(layout.mobile && !paneLayer ? panes.focusedTab : tabs.active);

  const accentOf = (environmentId: string | null | undefined) => {
    const accent = backend.environments.find((item) => item.id === environmentId)?.accent ?? null;
    return accentVars(accent === null ? theme.appAccent : theme.resolve(accent));
  };

  const centerAccent = $derived(accentOf(shownTab?.environmentId));
  const leftAccent = $derived(accentOf(panes.focusedTab?.environmentId));
  const rightAccent = $derived(
    accentOf(panes.kind === "chat" ? panes.rightTab?.environmentId : backend.activeId),
  );

  const MIN_SIDE_WIDTH = 280;

  const NOTICE_KEYS: Record<CompatNotice, string> = {
    app_outdated: "COMPAT_APP_OUTDATED",
    server_outdated: "COMPAT_SERVER_OUTDATED",
    cli_outdated: "COMPAT_CLI_OUTDATED",
    unauthorized: "COMPAT_UNAUTHORIZED",
    token_rejected: "COMPAT_TOKEN_REJECTED",
    update_available: "UPDATE_AVAILABLE",
  };

  let expanded = $state(settings.leftExpanded);
  let leftWidth = $state(settings.leftWidth);
  let rightWidth = $state(settings.rightWidth);
  let resizing = $state(false);
  let pinned: { left: number; right: number } | null = null;

  const sideRoom = $derived(layout.width - MIN_SIDE_WIDTH);

  const fitWidths = (left: number, leftMin: number, right: number, rightMin: number) => {
    const excess = left + right - sideRoom;
    const slack = left - leftMin + right - rightMin;
    if (excess <= 0 || slack <= 0) return { left, right };
    const share = Math.min(excess, slack) / slack;
    return { left: left - (left - leftMin) * share, right: right - (right - rightMin) * share };
  };

  const leftMin = $derived(expanded ? LEFT_MIN_WIDTH : RAIL_WIDTH);
  const leftWanted = $derived(expanded ? Math.max(leftWidth, LEFT_MIN_WIDTH) : RAIL_WIDTH);
  const sides = $derived(fitWidths(leftWanted, leftMin, Math.max(rightWidth, MIN_SIDE_WIDTH), MIN_SIDE_WIDTH));
  const panelWidth = $derived(Math.round(sides.right));
  const rightShown = $derived(panes.open && !navigation.centered);
  const leftShown = $derived(Math.round(rightShown ? sides.left : fitWidths(leftWanted, leftMin, 0, 0).left));

  const pushed = (value: number, kept: number, min: number) => Math.max(min, Math.min(kept, sideRoom - value));

  const pinWidths = (active: boolean) => {
    resizing = active;
    if (active) {
      pinned = { left: leftShown, right: panelWidth };
      if (expanded) leftWidth = leftShown;
      rightWidth = panelWidth;
      return;
    }
    pinned = null;
    if (expanded) settings.leftWidth = leftWidth;
    settings.rightWidth = rightWidth;
  };

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
  let paneFrame = $state<HTMLElement | null>(null);

  const paneGap = $derived.by(() => {
    void layout.width;
    return paneFrame ? parseFloat(getComputedStyle(paneFrame).paddingLeft) : 0;
  });

  $effect(() => {
    if (paneLayer) paneOpened = true;
  });

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

  const dismissNotice = (notice: CompatNotice) => {
    if (notice === "update_available") serverStatus.skipRelease();
    else dismissed = [...dismissed, notice];
  };

  const tabShift = settling(() => tabs.activeId);
  const routeShift = settling(() => navigation.centered);
  const modeShift = settling(() => layout.mobile);
  const sizeShift = settling(() => layout.width);
  const instantLayout = $derived(tabShift.active);
  const still = $derived(resizing || routeShift.active || modeShift.active || sizeShift.active);

  $effect(() => {
    layout.bottomInset = (panes.centerBusy ? 0 : composerHeight) + paneGap;
    return () => (layout.bottomInset = 0);
  });

  $effect(() => {
    const desktop = !layout.mobile && (navigation.chatActive || navigation.centered);
    layout.leftInset = desktop ? (expanded ? leftShown : RAIL_WIDTH) : 0;
    layout.rightInset = desktop ? (rightShown ? panelWidth + 2 * paneGap : paneGap) : 0;
    layout.insetsAnimated = !still;
    return () => {
      layout.leftInset = 0;
      layout.rightInset = 0;
    };
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
    pointerX >= layout.width - panelWidth ? "right" : "center";

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

  const dragTab = (id: string, pointerX: number) => panes.dragTab(id, paneAt(pointerX));

  const dockLift = $derived(Math.max(0, layout.dockInset - composerHeight - layout.safeBottom - paneGap));

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

{#if paneKept}
  <div
    class="safe-area fixed inset-x-0 top-0 z-40 bg-background {paneLayer ? '' : 'invisible'}"
    style="height: calc(100% - var(--keyboard, 0px)); {rightAccent}"
    inert={!paneLayer}
  >
    <PaneContent instant={instantLayout} centerView={false} {terminalCwd} />
  </div>
{/if}

<div class="flex h-full {layout.mobile ? '' : 'bg-surface'}">
  {#if !layout.mobile}
    <LeftPane
      {chat}
      accent={leftAccent}
      {expanded}
      width={leftShown}
      max={sideRoom - (rightShown ? MIN_SIDE_WIDTH : 0)}
      resizing={still}
      onExpanded={setExpanded}
      onWidth={(value) => {
        leftWidth = value;
        if (panes.open && pinned) rightWidth = pushed(value, pinned.right, MIN_SIDE_WIDTH);
      }}
      onDragging={pinWidths}
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
    class="relative flex min-w-0 flex-1 flex-col {layout.mobile ? '' : `my-(--pane-gap) ${PANE_CARD_CLASS}`}"
    style={centerAccent}
    data-unfocused={centerFocused ? undefined : true}
    onpointerdowncapture={(event) => focusFrom(event, "center")}
  >
    {#if navigation.centered}
      <div class="flex min-h-0 flex-1 flex-col">
        <RouteScreen />
      </div>
    {/if}
    <div class={navigation.centered ? "hidden" : "contents"} inert={navigation.centered}>
      {#if !layout.mobile && !panes.centerBusy}
        <TabStrip
          items={tabs.center}
          activeId={tabs.activeId}
          onSelect={(id) => tabs.select(id)}
          onNew={() => tabs.newTab()}
          newShortcut="tab.new"
          onClose={(id) => panes.close(id)}
          onMove={(id, index) => tabs.move(id, index)}
          onDrop={() => panes.dropTab()}
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
          chat={tabs.stateFor(shownTab)}
          viewKey={shownTab.id}
          primary
          focused={chatFocused}
          {dockLift}
          instant={instantLayout}
          navigationIcon={layout.mobile ? menuButton : undefined}
          notices={notices.length ? compatNotices : undefined}
          onComposerHeight={(height) => (composerHeight = height)}
        />
      {/if}
      {#if panes.dropTarget === "center"}
        {@render dropHint()}
      {/if}
    </div>
  </div>

  {#if !layout.mobile}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative h-full shrink-0 overflow-hidden {still
        ? ''
        : 'transition-[width] duration-200'}"
      style="width: {rightShown ? `calc(${panelWidth}px + 2 * var(--pane-gap))` : 'var(--pane-gap)'}; {rightAccent}"
      data-unfocused={panes.focused === "right" ? undefined : true}
      onpointerdowncapture={(event) => focusFrom(event, "right")}
    >
      <div
        bind:this={paneFrame}
        class="relative flex h-full p-(--pane-gap)"
        style="width: calc({panelWidth}px + 2 * var(--pane-gap))"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          class="absolute inset-y-0 left-0 z-30 w-(--pane-gap) cursor-col-resize {rightShown ? '' : 'hidden'}"
          use:resizeHandle={{
            axis: "x",
            invert: true,
            value: () => panelWidth,
            min: MIN_SIDE_WIDTH,
            max: () => sideRoom - leftMin,
            onResize: (value) => {
              rightWidth = value;
              if (expanded && pinned) leftWidth = pushed(value, pinned.left, LEFT_MIN_WIDTH);
            },
            onDragging: pinWidths,
          }}
        ></div>
        <div class="relative flex min-w-0 flex-1 flex-col {PANE_CARD_CLASS}">
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
    </div>
  {/if}
</div>

{#snippet compatNotices()}
  {#each notices as notice (notice)}
    <NoticeCard
      text={t(NOTICE_KEYS[notice], serverStatus.release?.tag ?? "")}
      actionLabel={t("SETTINGS")}
      onAction={() => {
        dismissNotice(notice);
        if (notice === "unauthorized" || notice === "token_rejected") navigation.openSettings("environments");
        else if (notice === "server_outdated") navigation.openSettings("server");
        else if (notice !== "cli_outdated") navigation.openSettings("about");
        else if (layout.mobile) navigation.openClaude("cli");
        else navigation.openSettings("cli");
      }}
      onDismiss={() => dismissNotice(notice)}
    />
  {/each}
{/snippet}

{#snippet dropHint()}
  <div
    class="pointer-events-none absolute inset-0 z-40 animate-[drop-overlay-enter_90ms_ease-out] rounded-panel {DROP_BORDER_CLASS}"
  ></div>
{/snippet}

{#snippet centerActions()}
  <PaneActions />
{/snippet}
{#snippet menuButton()}
  <TooltipIconButton label={t("MENU")} shortcut="panel.left" onclick={() => (drawer.open = true)}>
    <Menu />
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
    options={sessionColorOptions(chat.capabilities?.colors ?? [])}
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
    danger={!chat.trashEnabled}
    onConfirm={() => {
      void chat.remove(target);
      deleteTarget = null;
    }}
    onDismiss={() => (deleteTarget = null)}
  />
{/if}
