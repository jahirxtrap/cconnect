<script lang="ts">
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import History from "@lucide/svelte/icons/history";
  import Power from "@lucide/svelte/icons/power";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import SquareMousePointer from "@lucide/svelte/icons/square-mouse-pointer";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import Trash from "@lucide/svelte/icons/trash";
  import { untrack, type Snippet } from "svelte";
  import { openFilePreview } from "$lib/app/filePreview";
  import { navigation } from "$lib/app/navigation.svelte";
  import { screenFor } from "$lib/app/screens";
  import { isEditing } from "$lib/data/paneFocus.svelte";
  import { agentUp } from "$lib/data/agentModels";
  import { type InteractionData } from "$lib/data/chatModels";
  import { isArchive } from "$lib/data/format";
  import { liveLimits } from "$lib/data/liveLimits.svelte";
  import { projectNameOf, sessionIdPreview } from "$lib/data/models";
  import { isPreviewable } from "$lib/data/previewKind";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { onNativePaste } from "$lib/platform/pastedContent";
  import { isPackFile } from "$lib/design/packs/schema";
  import { offerShared } from "$lib/screens/packs/packIntake";
  import type { CommandOption } from "$lib/services/capabilitiesApi";
  import { provideServer } from "$lib/services/serverContext";
  import { downloadUrl, relativeFromUrl } from "$lib/services/sharedApi";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import Chip from "$lib/ui/Chip.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import { dropZone } from "$lib/app/dragPayload.svelte";
  import DropOverlay from "$lib/ui/DropOverlay.svelte";
  import { fileDrop } from "$lib/ui/fileDrop";
  import FloatDock from "$lib/ui/FloatDock.svelte";
  import NoticeCard from "$lib/ui/NoticeCard.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import { SCROLL_ROW_CLASS } from "$lib/ui/scrollbar";
  import SharedLinkActionsDialog from "$lib/ui/SharedLinkActionsDialog.svelte";
  import { LINK_LOOKS } from "$lib/ui/linkStatus";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ModBand from "$lib/screens/mods/ModBand.svelte";
  import type { ModCompletions, ModDecoration, ModStroke } from "$lib/data/modModels";
  import { BAND_ID, type ModHost } from "$lib/screens/mods/modSurface.svelte";
  import type { SuggestionPicker } from "$lib/markdown/cconnectBlock";
  import { copyText } from "$lib/platform/clipboard";
  import VisibilityDialog from "$lib/screens/settings/VisibilityDialog.svelte";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import { NO_BACKGROUND } from "$lib/design/backgrounds";
  import ComponentBlock from "./blocks/ComponentBlock.svelte";
  import AgentStatusCard from "./AgentStatusCard.svelte";
  import AgentToolbar from "./AgentToolbar.svelte";
  import ChatBackdrop from "./ChatBackdrop.svelte";
  import ChatToolbar from "./ChatToolbar.svelte";
  import ChatWelcome from "./ChatWelcome.svelte";
  import Composer from "./Composer.svelte";
  import MessageList from "./MessageList.svelte";
  import RewindDialog from "./RewindDialog.svelte";
  import PaneActions from "./PaneActions.svelte";
  import SidePanel from "./SidePanel.svelte";
  import ChatTabSwitcher from "./ChatTabSwitcher.svelte";
  import BackgroundTasks from "./BackgroundTasks.svelte";
  import TaskIndicator from "./TaskIndicator.svelte";
  import { panes } from "./panes.svelte";
  import { paneRole } from "./paneSurface";
  import AgentTabSwitcher from "$lib/screens/agents/AgentTabSwitcher.svelte";
  import { agentTabs } from "$lib/screens/agents/agentTabs.svelte";
  import type { ChatState } from "./state.svelte";
  import { tabs } from "./tabs.svelte";
  import { drawer } from "./drawer.svelte";
  import { pastedName } from "$lib/data/pastedFile";
  import { elementLabel, splitElements } from "$lib/data/pickedElements";

  interface Props {
    chat: ChatState;
    viewKey: string;
    primary?: boolean;
    focused?: boolean;
    dockLift?: number;
    instant?: boolean;
    navigationIcon?: Snippet;
    notices?: Snippet;
    onComposerHeight?: (height: number) => void;
  }

  const {
    chat,
    viewKey,
    primary = false,
    focused = true,
    dockLift = 0,
    instant = false,
    navigationIcon,
    notices,
    onComposerHeight,
  }: Props = $props();

  const SIDE_PEEK = 58;
  const OUTSIDE_TURN = ["usage", "reload"];

  provideServer(() => chat.environment);

  let confirmCommand = $state<CommandOption | null>(null);
  let rewindOpen = $state(false);
  let purgeViewOpen = $state(false);
  let closingResident = $state(false);
  let queuedId = $state<string | null>(null);
  let sharedLink = $state<{ url: string; filename: string } | null>(null);
  let visibilityOpen = $state(false);
  let sideHeight = $state(SIDE_PEEK);
  let sideDragging = $state(false);
  let composerHeight = $state(0);
  let opening = $state(false);

  const closeSide = () => {
    chat.closeSideChat();
    sideHeight = SIDE_PEEK;
  };

  $effect(() => {
    opening = chat.transcriptLoading;
  });

  $effect(() => {
    if (queuedId !== null && !chat.queueView.some((entry) => entry.id === queuedId)) queuedId = null;
  });

  $effect(() => {
    onComposerHeight?.(composerHeight);
  });

  const limits = $derived(liveLimits.of(chat.environmentId, chat.effectiveAccount) ?? []);
  const welcomeProject = $derived(
    chat.historyProject ? projectNameOf(chat.historyProjects, chat.historyProject, chat.cwd) : null,
  );
  const welcomeLink = $derived(
    chat.agent &&
      !chat.agentStarted &&
      chat.link === "connected" &&
      (chat.agentState?.status ?? "connecting") === "connecting"
      ? "connecting"
      : chat.link,
  );

  const dialogOpen = $derived(
    confirmCommand !== null ||
      rewindOpen ||
      queuedId !== null ||
      sharedLink !== null ||
      visibilityOpen ||
      navigation.previewOverlay ||
      (layout.mobile && drawer.showing),
  );

  const onPaste = (event: ClipboardEvent) => {
    if (!focused || event.defaultPrevented) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement) return;
    const data = event.clipboardData;
    const pasted = Array.from(data?.files ?? []);
    if (!pasted.length) {
      for (const item of Array.from(data?.items ?? [])) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file) pasted.push(file);
      }
    }
    const files = pasted.map(pastedName);
    if (!files.length || !canAttach || dialogOpen) return;
    event.preventDefault();
    chat.addAttachments(files);
  };

  $effect(() => {
    if (!focused) return;
    return onNativePaste((files) => canAttach && !dialogOpen && chat.addAttachments(files));
  });

  const openShared = (url: string, filename: string) => {
    if (isPackFile(filename)) {
      offerShared(url, filename);
      return;
    }
    if (!isPreviewable(filename)) {
      sharedLink = { url, filename };
      return;
    }
    const relative = relativeFromUrl(url);
    openFilePreview({
      url,
      name: filename,
      onDelete: relative ? () => void chat.shared.remove(relative) : null,
    });
  };

  const activity = $derived(chat.liveActivity);
  const busy = $derived(chat.busy);
  const resident = $derived(chat.resident && chat.link === "connected");
  const idle = $derived(chat.link === "connected" && !chat.transcriptLoading && !busy);
  const running = $derived(chat.backgroundView.length > 0);
  const blocked = $derived(
    chat.link === "disconnected" ||
      chat.link === "connecting" ||
      (chat.agent
        ? chat.agentState?.status !== "ready"
        : !chat.capabilitiesReady || chat.switchingAccount || !chat.capabilities?.models.length),
  );
  const actionsEnabled = $derived(!chat.agent || !blocked);
  const pane = paneRole() ?? "center";
  const chatsWindow = $derived(
    !!chat.agentState && (chat.agentState.sessions.load || chat.agentState.sessions.resume) && !panes.historyInList(pane),
  );
  const canAttach = $derived(!chat.sideOpen && actionsEnabled);

  const availableCommands = $derived.by(() => {
    if (chat.agent) return chat.connected ? (chat.agentState?.commands ?? []) : [];
    const all = chat.capabilities?.commands ?? [];
    if (chat.sideOpen || !chat.connected) return [];
    const outsideTurn = (command: CommandOption) => OUTSIDE_TURN.includes(command.kind);
    const usable = chat.sessionId !== null ? all : all.filter(outsideTurn);
    return busy ? usable.filter((command) => command.kind === "prompt" || outsideTurn(command)) : usable;
  });

  $effect(() => tabs.syncUrl());

  const status = $derived.by(() => {
    if (chat.viewOnly) return { dot: "bg-gray", spinner: false, text: t("TRASH") };
    if (chat.link !== "connected") {
      const look = LINK_LOOKS[chat.link];
      return { dot: look.dot, spinner: look.spinner, text: t(look.text) };
    }
    const agentStatus = chat.agent ? (chat.agentState?.status ?? "connecting") : "ready";
    if (agentStatus === "connecting") {
      const look = LINK_LOOKS.connecting;
      return { dot: look.dot, spinner: look.spinner, text: t(look.text) };
    }
    if (agentStatus === "auth") return { dot: "bg-orange", spinner: false, text: t("AGENT_SIGN_IN_NEEDED") };
    if (!agentUp(agentStatus)) return { dot: "bg-red", spinner: false, text: t("AGENT_UNAVAILABLE") };
    if (activity === "waiting") return { dot: "bg-orange", spinner: false, text: t("WAITING_USER") };
    if (activity === "compacting") return { dot: "bg-gray", spinner: true, tone: "text-blue", text: t("COMPACTING") };
    if (activity === "retrying") return { dot: "bg-gray", spinner: true, tone: "text-yellow", text: t("WORKING") };
    if (activity === "working") return { dot: "bg-gray", spinner: true, text: t("WORKING") };
    if (activity === "failed")
      return {
        dot: "bg-red",
        spinner: false,
        text: chat.sessionId ? sessionIdPreview(chat.sessionId) : t("NEW_CHAT"),
      };
    if (activity === "persistent") return { dot: "bg-green", spinner: false, ring: true, text: t("PERSISTENT_ALIVE") };
    return {
      dot: "bg-green",
      spinner: false,
      text: chat.sessionId ? sessionIdPreview(chat.sessionId) : t("NEW_CHAT"),
    };
  });

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !chat.sideOpen) return false;
      closeSide();
      return true;
    }),
  );

  let judgedPane: string | null = null;

  const keysFree = () => {
    const active = document.activeElement;
    if (!active || active === document.body || composer?.holdsKeys()) return true;
    return !active.closest("[data-mod-site]") && !isEditing();
  };

  $effect(() => {
    const requested = chat.mods.state.focusRequestedId;
    if (requested === null) judgedPane = null;
    if (!requested || requested === judgedPane || !primary || document.visibilityState !== "visible") return;
    judgedPane = requested;
    untrack(() => {
      if (chat.draft.trim() || dialogOpen || activity === "waiting" || !keysFree()) {
        const held = document.activeElement?.closest("[data-mod-site]");
        chat.mods.act("focus", { id: held ? chat.mods.state.focusedId : null });
        return;
      }
      panes.show("mods");
      chat.mods.act("focus", { id: requested });
      chat.mods.raised = requested;
    });
  });

  let composer = $state<Composer | null>(null);
  let lastSelection = "";

  const composerFree = () => !chat.sideOpen && !chat.viewOnly && !dialogOpen;

  const onselectionchange = () => {
    const text = window.getSelection()?.toString() ?? "";
    if (text.trim()) lastSelection = text;
  };

  let wasBusy = false;

  $effect(() => {
    if (wasBusy && !busy) lastSelection = "";
    wasBusy = busy;
  });

  const pickerFor = (working: boolean, send: (text: string) => void): SuggestionPicker | null =>
    chat.viewOnly || working
      ? null
      : {
          pick: (item) => (item.mode === "draft" ? (chat.pendingInput = item.text) : send(item.text)),
          sends: !blocked,
        };

  const pickSuggestion = $derived(pickerFor(chat.busy, (text) => chat.submit(text)));
  const pickSideSuggestion = $derived(pickerFor(chat.sideStreaming, (text) => chat.sendSideQuestion(text)));

  $effect(() => {
    const mods = chat.mods;
    const host: ModHost = {
      read: () => ({ text: chat.draft, cursor: composer?.caret() ?? chat.draft.length }),
      fill: (text, mode) => {
        if (!composerFree() || !composer) return false;
        composer.place(text, mode);
        return true;
      },
      suggest: (text) => {
        if (!composerFree() || busy || chat.draft) return false;
        mods.suggestion = text;
        return true;
      },
      copy: (text) => copyText(text),
      selection: () => lastSelection,
      pickSuggestion,
    };
    mods.host = host;
    return () => {
      if (mods.host === host) mods.host = null;
    };
  });

  $effect(() => {
    if (chat.draft || busy) chat.mods.suggestion = null;
  });

  const bandKey = (event: KeyboardEvent, empty: boolean) =>
    empty &&
    /^[0-9]$/.test(event.key) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    chat.mods.hotkey("AbovePrompt", BAND_ID, event.key);

  let reported = "";
  let completions = $state<ModCompletions | null>(null);
  let decorations = $state<ModDecoration[]>([]);

  const promptEdit = (text: string, cursor: number, stroke: ModStroke | null) => {
    reported = text;
    completions = null;
    void chat.mods.edit(text, cursor, stroke, "person").then((box) => {
      if (!box || box.superseded || chat.draft !== text) return;
      decorations = box.decorations;
      if (box.text === text) return;
      reported = box.text;
      composer?.adopt(box.text, box.cursor);
    });
    void chat.mods.complete(text, cursor).then((found) => {
      if (chat.draft === text) completions = found;
    });
  };

  $effect(() => {
    const draft = chat.draft;
    if (!chat.mods.state.surface || chat.sideOpen || draft === reported) return;
    reported = draft;
    completions = null;
    decorations = [];
    void chat.mods.edit(draft, draft.length, null, "app");
  });
</script>

<svelte:window onpaste={onPaste} />
<svelte:document {onselectionchange} />

<AppTopBar title={chat.agent ? chat.agentName : t("APP_NAME")} subtitle={status.text} {navigationIcon}>
  {#snippet subtitleLeading()}
    <StatusDot
      class={status.dot}
      loading={status.spinner}
      spinnerClass={"tone" in status ? status.tone : undefined}
      ring={resident || "ring" in status}
    />
  {/snippet}
  {#snippet actions()}
    {#if chat.viewOnly}
      <TooltipIconButton label={t("RESTORE")} onclick={() => void chat.restoreViewOnly()}>
        <RotateCcw />
      </TooltipIconButton>
      <TooltipIconButton label={t("DELETE")} onclick={() => (purgeViewOpen = true)}>
        <Trash />
      </TooltipIconButton>
    {:else}
      {#if !chat.agent && chat.sessionId !== null && idle && !running}
        <TooltipIconButton
          label={t("REWIND")}
          onclick={() => {
            rewindOpen = true;
            void chat.loadRewindPoints();
          }}
        >
          <RotateCcw />
        </TooltipIconButton>
      {/if}
      {#if activity === "persistent"}
        <TooltipIconButton
          label={t("PERSISTENT_CLOSE")}
          onclick={() => (running ? (closingResident = true) : chat.closeResident())}
        >
          <Power />
        </TooltipIconButton>
      {/if}
      <BackgroundTasks tasks={chat.backgroundView} onStop={(id) => chat.stopTask(id)} />
      <TaskIndicator todos={chat.todosView} />
      {#if chatsWindow}
        <TooltipIconButton label={t("CHATS")} onclick={() => (agentTabs.history[pane] = true)}>
          <History />
        </TooltipIconButton>
      {/if}
    {/if}
    {#if layout.mobile && primary}
      {#if chat.agent}
        <AgentTabSwitcher role={pane} />
      {:else}
        <ChatTabSwitcher />
      {/if}
      <PaneActions />
    {/if}
    <TooltipIconButton
      label={t("NEW_CHAT")}
      onclick={() =>
        chat.agent ? agentTabs.restart(chat) : chat.viewOnly ? chat.closeViewOnly() : chat.newSession()}
    >
      <SquarePen />
    </TooltipIconButton>
  {/snippet}
</AppTopBar>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  use:dropZone={{
    accepts: (payload) => payload.files.length > 0 && !chat.viewOnly && canAttach,
    drop: (payload) => chat.addSharedAttachments(payload.files),
  }}
  use:fileDrop={{
    accepts: () => !chat.viewOnly && canAttach,
    drop: (files) => chat.addAttachments(files),
  }}
  class="relative isolate flex min-h-0 flex-1 flex-col"
>
  {#if chatBackground.current !== NO_BACKGROUND}
    <ChatBackdrop id={chatBackground.current} effects={chatBackground.effects} class="-z-10" />
  {/if}
  <DropOverlay />
  <div class="relative min-h-0 flex-1 overflow-hidden">
    {#if opening}
      <CenteredProgress class="absolute inset-0 z-10" />
    {:else if !chat.view.length && (chat.agent || !chat.sessionId) && !chat.streaming}
      <ChatWelcome
        project={welcomeProject}
        link={welcomeLink}
        icon={chat.agent ? screenFor("agents").icon : undefined}
      />
    {/if}
    <div
      class="overflow-hidden {opening ? 'opacity-0' : ''} {sideDragging || instant
        ? ''
        : 'transition-[height] duration-[350ms] ease-[cubic-bezier(0.33,1,0.68,1)]'}"
      style="height: {chat.sideOpen ? Math.max(0, 100 - sideHeight) : 100}%"
    >
      {#key viewKey}
        <MessageList
          messages={chat.view}
          pendingToolIds={chat.runningView}
          streaming={chat.streaming}
          compacting={chat.compacting || activity === "compacting"}
          streamStatus={chat.streamStatus}
          apiRetry={chat.apiRetry}
          visibility={{
            thinking: chat.showThinking,
            toolUse: chat.showToolUse,
            fileChange: chat.showFileChange,
            compact: chat.showCompact,
          }}
          onAnswer={(requestId, optionId) => chat.answerInteraction(requestId, optionId)}
          onLoadOlder={() => chat.loadOlder()}
          bind:follow={chat.followBottom}
          onSharedLink={openShared}
          onSharedMenu={(url, filename) => (sharedLink = { url, filename })}
          onSuggest={pickSuggestion}
          sessionId={chat.sessionId}
          timestamps={!chat.agent}
          mods={chat.mods}
          expandedIds={chat.expandedIds}
          savedTop={chat.scrollTop}
          onScrollTop={(top) => (chat.scrollTop = top)}
          {component}
          bottomInset={dockLift}
        />
      {/key}
    </div>
    {#if notices || chat.mods.toasts.length}
      <FloatDock stacked>
        {@render notices?.()}
        {#each chat.mods.toasts as toast (toast.id)}
          <NoticeCard text={toast.text} onDismiss={() => chat.mods.dismissToast(toast.id)} />
        {/each}
      </FloatDock>
    {/if}
    {#if chat.sideOpen}
      <SidePanel
        messages={chat.showWorking === "label" ? chat.sideMessages : chat.sideMessages.filter((item) => item.role !== "working")}
        height={sideHeight}
        {instant}
        onHeight={(value) => (sideHeight = value)}
        onDragging={(value) => (sideDragging = value)}
        onClear={() => chat.clearSideChat()}
        streaming={chat.sideStreaming}
        onSuggest={pickSideSuggestion}
        onClose={closeSide}
        onAnswer={(requestId, optionId) => chat.answerInteraction(requestId, optionId)}
        {component}
        bottomInset={dockLift}
      />
    {/if}
  </div>

  {#if !chat.viewOnly}
    <div class="shrink-0 {chat.sideOpen ? 'bg-background' : ''}" bind:clientHeight={composerHeight}>
      {#snippet band()}
        {#if chat.agent}
          <AgentStatusCard {chat} />
        {:else}
          <ModBand
            mods={chat.mods}
            draft={!!chat.draft}
            working={busy}
            hidden={chat.sideOpen}
            {instant}
            active={focused}
          />
        {/if}
      {/snippet}
      <Composer
        {band}
        bind:this={composer}
        ghost={chat.sideOpen ? null : chat.mods.suggestion}
        onKey={chat.sideOpen ? undefined : bandKey}
        onEdit={chat.sideOpen ? undefined : promptEdit}
        completions={chat.sideOpen ? null : completions}
        decorations={chat.sideOpen ? [] : decorations}
        {focused}
        {blocked}
        {actionsEnabled}
        streaming={chat.sideOpen ? chat.sideStreaming : busy}
        draft={chat.sideOpen ? chat.sideDraft : chat.draft}
        onDraft={(value) => (chat.sideOpen ? (chat.sideDraft = value) : (chat.draft = value))}
        attachments={chat.sideOpen ? [] : chat.attachments}
        elements={chat.sideOpen ? [] : chat.elements}
        onRemoveElement={(id) => chat.removeElement(id)}
        uploading={!chat.sideOpen && chat.uploading}
        queue={chat.sideOpen ? [] : chat.visibleQueue}
        onOpenQueued={(item) => (queuedId = item.id)}
        commands={availableCommands}
        pendingInput={chat.pendingInput}
        onConsumePending={() => chat.consumePendingInput()}
        onSend={(text) => (chat.sideOpen ? chat.sendSideQuestion(text) : chat.submit(text))}
        history={() => chat.userHistory()}
        onCommand={(command) =>
          command.requireConfirmation ? (confirmCommand = command) : chat.runCommand(command)}
        onInterrupt={() => (chat.sideOpen ? chat.stopSide() : chat.interrupt())}
        onAttach={(files) => chat.addAttachments(files)}
        onRemoveAttachment={(id) => chat.removeAttachment(id)}
        onCloseSide={chat.sideOpen ? closeSide : null}
        sessionColor={chat.sessionColor}
        controls={chat.sideOpen ? undefined : controls}
      />
    </div>
  {/if}
</div>

{#snippet controls()}
  {#if chat.agent}
    <AgentToolbar
      agent={chat.agentState}
      link={chat.link}
      loading={chat.transcriptLoading}
      contextTokens={chat.contextView}
      contextWindow={chat.contextWindow}
      simpleMode={chat.effectiveVisibility.simple}
      onOption={(id, value) => chat.setAgentOption(id, value)}
      onVisibility={() => (visibilityOpen = true)}
    />
  {:else}
    <ChatToolbar
      capabilities={chat.capabilities}
      ready={chat.capabilitiesReady}
      connecting={chat.link === "connecting"}
      disconnected={chat.link === "disconnected"}
      loading={chat.transcriptLoading}
      model={chat.effectiveModel}
      modelSelected={chat.modelOverride}
      effort={chat.effectiveEffort}
      effortSelected={chat.effortOverride}
      permissionMode={chat.effectivePermissionMode}
      permissionSelected={chat.permissionOverride}
      account={chat.effectiveAccount}
      switching={chat.switchingAccount}
      accountSelected={chat.accountOverride}
      onAccount={(value) => chat.setAccount(value)}
      streamTokens={chat.effectiveStreamTokens}
      contextTokens={chat.contextView}
      cache={resident ? chat.cacheView : null}
      compactWindow={chat.compactWindow}
      requestBytes={chat.requestView}
      mediaBytes={chat.mediaView}
      {limits}
      onModel={(value) => chat.setModel(value)}
      onEffort={(value) => chat.setEffort(value)}
      onPermissionMode={(value) => chat.setPermissionMode(value)}
      onStreamTokens={(value) => chat.setStreamTokens(value)}
      streamingSelected={chat.streamingOverride === null ? "" : chat.streamingOverride ? "on" : "off"}
      simpleMode={chat.effectiveVisibility.simple}
      onVisibility={() => (visibilityOpen = true)}
      onQuickChat={() => (chat.sideOpen ? closeSide() : chat.openSideChat())}
      quickChatActive={chat.sideMessages.length > 0}
    />
  {/if}
{/snippet}

{#snippet component(data: InteractionData, onGrow: (grow: () => void, anchor: HTMLElement | null) => void)}
  <ComponentBlock
    {data}
    {onGrow}
    colors={chat.capabilities?.colors ?? []}
    onValue={(id, value) => chat.setComponentValue(data.requestId, id, value)}
    onPick={(id, value, multiple) => chat.toggleComponentOption(data.requestId, id, value, multiple)}
    onSubmit={(action) => chat.submitComponent(data.requestId, action)}
    onDismiss={(via) => chat.declineQuestions(data.requestId, via)}
    onPage={(index) => chat.setActivePage(data.requestId, index)}
    onPreviewOpen={openShared}
    onUpload={(file, onProgress) => chat.uploadComponentFile(file, onProgress)}
  />
{/snippet}

{#if rewindOpen}
  <RewindDialog
    points={chat.rewindPoints}
    loading={chat.rewindLoading}
    target={chat.rewindTarget}
    preview={chat.rewindPreview}
    busy={chat.rewindBusy}
    onSelect={(point) => void chat.selectRewindPoint(point)}
    onBack={() => chat.clearRewindTarget()}
    onRewind={(mode) =>
      void chat.rewind(mode).then((done) => {
        if (done) rewindOpen = false;
      })}
    onDismiss={() => {
      chat.dismissRewind();
      rewindOpen = false;
    }}
  />
{/if}

{#if visibilityOpen}
  {@const local = settings.visibility}
  {@const remote = chat.serverVisibility}
  <VisibilityDialog
    server={{
      simple: remote.simple ? "on" : "off",
      thinking: remote.thinking,
      toolUse: remote.tool_use,
      fileChange: remote.file_change,
      compact: remote.compact,
      working: remote.working,
      tokens: remote.tokens ? "on" : "off",
      timings: remote.timings ? "on" : "off",
    }}
    simple={local.simple === null ? "" : local.simple ? "on" : "off"}
    thinking={local.thinking ?? ""}
    toolUse={local.tool_use ?? ""}
    fileChange={local.file_change ?? ""}
    compact={local.compact ?? ""}
    working={local.working ?? ""}
    tokens={local.tokens === null ? "" : local.tokens ? "on" : "off"}
    timings={local.timings === null ? "" : local.timings ? "on" : "off"}
    onConfirm={(values) => {
      tabs.applyVisibility({
        simple: values.simple === "" ? null : values.simple === "on",
        thinking: values.thinking || null,
        tool_use: values.toolUse || null,
        file_change: values.fileChange || null,
        compact: values.compact || null,
        working: values.working || null,
        tokens: values.tokens === "" ? null : values.tokens === "on",
        timings: values.timings === "" ? null : values.timings === "on",
      });
      agentTabs.syncVisibility();
      visibilityOpen = false;
    }}
    onDismiss={() => (visibilityOpen = false)}
  />
{/if}

{#if sharedLink}
  {@const target = sharedLink}
  {@const relative = relativeFromUrl(target.url)}
  <SharedLinkActionsDialog
    url={target.url}
    filename={target.filename}
    onView={() =>
      openFilePreview({
        url: target.url,
        name: target.filename,
        onDelete: relative ? () => void chat.shared.remove(relative) : null,
      })}
    onOpenInShared={relative && isArchive(target.filename)
      ? () => navigation.openShared(relative)
      : null}
    onDismiss={() => (sharedLink = null)}
  />
{/if}

{#if queuedId && !navigation.preview}
  {@const item = chat.queueView.find((entry) => entry.id === queuedId) ?? null}
  {#if item}
    <CompactDialog title={t("QUEUED_MESSAGE")} onDismiss={() => (queuedId = null)}>
      {#snippet buttons()}
        <Button onclick={() => (queuedId = null)} variant="outlined">{t("CANCEL")}</Button>
        <Button
          variant="destructive"
          onclick={() => {
            chat.removeQueued(item.id);
            queuedId = null;
          }}
        >
          {t("DELETE")}
        </Button>
      {/snippet}
      {@const queued = splitElements(item.text)}
      {#if queued.text.trim()}
        <CardPanel>
          <p class="selectable text-body-md wrap-anywhere whitespace-pre-wrap">{queued.text}</p>
        </CardPanel>
      {/if}
      {#if queued.elements.length}
        <div class="{SCROLL_ROW_CLASS} mt-2 flex gap-1.5">
          {#each queued.elements as element, index (index)}
            <Chip name={elementLabel(element)} icon={SquareMousePointer} />
          {/each}
        </div>
      {/if}
      {#if item.attachments.length}
        <div class="{SCROLL_ROW_CLASS} mt-2 flex gap-1.5">
          {#each item.attachments as attachment (attachment)}
            {@const name = attachment.split("/").pop() ?? attachment}
            <Chip
              {name}
              icon={isArchive(name) ? FolderArchive : FileIcon}
              onclick={() => openFilePreview({ url: downloadUrl(attachment, chat.environment), name, onDelete: null })}
              onmenu={() => {
                queuedId = null;
                sharedLink = { url: downloadUrl(attachment, chat.environment), filename: name };
              }}
            />
          {/each}
        </div>
      {/if}
    </CompactDialog>
  {/if}
{/if}

{#if confirmCommand}
  {@const command = confirmCommand}
  <ConfirmDialog
    title="/{command.name}"
    text={command.description}
    confirmLabel={t("CONFIRM")}
    onConfirm={() => {
      chat.runCommand(command);
      confirmCommand = null;
    }}
    onDismiss={() => (confirmCommand = null)}
  />
{/if}

{#if closingResident}
  <ConfirmDialog
    title={t("CLOSE")}
    text={t("PERSISTENT_CLOSE_CONFIRM")}
    confirmLabel={t("CLOSE")}
    danger
    onConfirm={() => {
      chat.closeResident();
      closingResident = false;
    }}
    onDismiss={() => (closingResident = false)}
  />
{/if}

{#if purgeViewOpen && chat.viewOnly}
  {@const target = chat.viewOnly}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_CONVERSATION_CONFIRM", target.title ?? sessionIdPreview(target.sessionId))}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => {
      void chat.purgeViewOnly();
      purgeViewOpen = false;
    }}
    onDismiss={() => (purgeViewOpen = false)}
  />
{/if}
