<script lang="ts">
  import { flushSync } from "svelte";
  import Menu from "@lucide/svelte/icons/menu";
  import { closeFilePreview } from "$lib/app/filePreview";
  import { navigation } from "$lib/app/navigation.svelte";
  import RouteScreen from "$lib/app/RouteScreen.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { accentVars, theme } from "$lib/design/theme.svelte";
  import { serverStatus, type CompatNotice } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { useAgents } from "$lib/services/agents.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import Drawer from "$lib/ui/Drawer.svelte";
  import { DROP_BORDER_CLASS } from "$lib/ui/fileDrop";
  import NoticeCard from "$lib/ui/NoticeCard.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { resizeHandle } from "$lib/ui/resizeHandle";
  import { settling } from "$lib/ui/settling.svelte";
  import AgentList from "$lib/screens/agents/AgentList.svelte";
  import ChatView from "./ChatView.svelte";
  import PaneActions from "./PaneActions.svelte";
  import { PANE_CARD_CLASS } from "./paneChrome";
  import PaneContent from "./PaneContent.svelte";
  import PanelPreview, { previewFills } from "./PanelPreview.svelte";
  import PaneViewMenu from "./PaneViewMenu.svelte";
  import ChatList from "./ChatList.svelte";
  import ChatListDialogs from "./ChatListDialogs.svelte";
  import { ChatListEdits } from "./chatListEdits.svelte";
  import { panes } from "./panes.svelte";
  import LeftPane, { LEFT_MIN_WIDTH, RAIL_WIDTH } from "./LeftPane.svelte";
  import OrganizeDialog from "./OrganizeDialog.svelte";
  import TabStrip from "./TabStrip.svelte";
  import type { ChatState } from "./state.svelte";
  import { tabs, type PaneRole } from "./tabs.svelte";
  import { drawer } from "./drawer.svelte";

  useAgents();

  const listChat = $derived(panes.listChat);
  const paneLayer = $derived(layout.mobile && panes.overlaid);
  let paneOpened = $state(false);
  const paneKept = $derived(paneOpened && layout.mobile && panes.kind !== panes.centerKind);
  const centerGroup = $derived(panes.groupAt("center"));
  const shownTab = $derived(layout.mobile && !paneLayer ? panes.focusedTab : panes.tabAt("center"));

  const accentOf = (environmentId: string | null | undefined) => {
    const accent = backend.environments.find((item) => item.id === environmentId)?.accent ?? null;
    return accentVars(accent === null ? theme.appAccent : theme.resolve(accent));
  };

  const centerAccent = $derived(
    accentOf(layout.mobile && centerGroup !== null ? shownTab?.environmentId : panes.environmentAt("center")),
  );
  const leftAccent = $derived(accentOf(panes.listEnvironment));
  const rightAccent = $derived(accentOf(panes.environmentAt("right")));

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
  const centerFilled = $derived(previewFills("center"));
  const centerFocused = $derived(layout.mobile ? !paneLayer : panes.focused === "center");
  const chatFocused = $derived(centerFocused && !panes.centerBusy);

  const terminalCwd = $derived([panes.contextChat.workingPath, panes.contextChat.defaultCwd].filter(Boolean));

  const listEdits = new ChatListEdits(() => panes.listChat);
  let organizing = $state<ChatState | null>(null);
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
    layout.bottomInset = (panes.centerBusy || centerGroup === null ? 0 : composerHeight) + paneGap;
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
    if (layout.mobile || navigation.centered) return;
    if ((event.target as HTMLElement | null)?.closest('[role="separator"]')) return;
    flushSync(() => panes.focus(role));
  };

  const chatsSide = $derived(panes.open && centerGroup !== null && panes.groupAt("right") !== null);

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

  const dragAgentTab = (id: string, pointerX: number) => panes.dragAgentTab(id, paneAt(pointerX));

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
      onNewChat={() => {
        panes.newListChat();
        navigation.showChat();
      }}
    >
      {@render sideList(false, () => setExpanded(false), () => navigation.showChat())}
    </LeftPane>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex min-w-0 flex-1 flex-col {layout.mobile ? '' : `my-(--pane-gap) ${PANE_CARD_CLASS}`}"
    style={centerAccent}
    data-unfocused={centerFocused || navigation.centered ? undefined : true}
    onpointerdowncapture={(event) => focusFrom(event, "center")}
  >
    {#if navigation.centered}
      <div class="flex min-h-0 flex-1 flex-col">
        <RouteScreen />
      </div>
    {/if}
    <div class={navigation.centered ? "hidden" : "contents"} inert={navigation.centered}>
      {#if centerFilled}
        <PanelPreview role="center" />
      {:else if centerGroup === null}
        <PaneContent
          role="center"
          instant={instantLayout}
          {centerView}
          {terminalCwd}
          onPaneDrag={panes.open ? (dx, done) => dragPanes(dx, done, "center") : undefined}
          onAgentTabDrag={dragAgentTab}
          lead={layout.mobile ? menuButton : undefined}
        />
      {:else}
        {#if !layout.mobile}
          <TabStrip
            items={tabs.center}
            activeId={tabs.activeId}
            onSelect={(id) => tabs.select(id)}
            onNew={() => panes.newTab()}
            newShortcut="tab.new"
            onClose={(id) => panes.close(id)}
            onMove={(id, index) => tabs.move(id, index)}
            onDrop={() => panes.dropTab()}
            onPaneDrag={panes.open ? (dx, done) => dragPanes(dx, done, "center") : undefined}
            onTabDrag={chatsSide ? dragTab : undefined}
            group="chat"
            focused={chatFocused}
            trailing={centerActions}
          />
        {/if}
        {#if shownTab}
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
            onAgentTabDrag={dragAgentTab}
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
  <PaneViewMenu role="center" all />
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
    {@render sideList(true, layout.touch ? null : () => (drawer.open = false), () => (drawer.open = false))}
  </Drawer>
{/if}

{#snippet sideList(drawerMode: boolean, onClose: (() => void) | null, onAfterSelect: () => void)}
  {#if panes.list.kind === "agents"}
    <AgentList
      role={panes.list.role}
      {drawerMode}
      {onClose}
      {onAfterSelect}
      onOrganize={(target) => (organizing = target)}
    />
  {:else}
    <ChatList
      chat={listChat}
      edits={listEdits}
      {drawerMode}
      {onClose}
      onAfterSelect={() => {
        panes.revealList();
        onAfterSelect();
      }}
      onNewTab={(categoryId) => panes.newTab(categoryId, panes.list.role)}
      onOpenSession={(session) => panes.openSession(session, panes.list.role)}
      onOpenRight={panes.canOpenRight(panes.list.role) ? (session) => panes.openInRight(session) : null}
    />
  {/if}
{/snippet}

<ChatListDialogs edits={listEdits} onOpenChat={() => (drawer.open = false)} />

{#if organizing}
  <OrganizeDialog
    chat={organizing}
    projectsOnly
    onDismiss={() => (organizing = null)}
    onOpenChat={() => (drawer.open = false)}
  />
{/if}
