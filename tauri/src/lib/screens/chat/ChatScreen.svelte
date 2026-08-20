<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import FileIcon from "@lucide/svelte/icons/file";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import History from "@lucide/svelte/icons/history";
  import Menu from "@lucide/svelte/icons/menu";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import Settings from "@lucide/svelte/icons/settings";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Type from "@lucide/svelte/icons/type";
  import { navigation } from "$lib/app/navigation.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { isPending, type InteractionData } from "$lib/data/chatModels";
  import { isArchive } from "$lib/data/format";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import type { SessionInfo } from "$lib/data/models";
  import { serverStatus, type CompatNotice } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import type { CommandOption } from "$lib/services/capabilitiesApi";
  import { downloadUrl, relativeFromUrl, sharedApi } from "$lib/services/sharedApi";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Chip from "$lib/ui/Chip.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import ColorDialog from "$lib/ui/ColorDialog.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import Drawer from "$lib/ui/Drawer.svelte";
  import DropOverlay from "$lib/ui/DropOverlay.svelte";
  import NoticeCard from "$lib/ui/NoticeCard.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SharedLinkActionsDialog from "$lib/ui/SharedLinkActionsDialog.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChatPanel from "./ChatPanel.svelte";
  import ChatToolbar from "./ChatToolbar.svelte";
  import Composer from "./Composer.svelte";
  import MessageList from "./MessageList.svelte";
  import QuestionsBlock from "./blocks/QuestionsBlock.svelte";
  import VisibilityDialog from "$lib/screens/settings/VisibilityDialog.svelte";
  import RewindDialog from "./RewindDialog.svelte";
  import SidePanel from "./SidePanel.svelte";
  import TabStrip from "./TabStrip.svelte";
  import TabSwitcher from "./TabSwitcher.svelte";
  import TaskIndicator from "./TaskIndicator.svelte";
  import { tabs } from "./tabs.svelte";
  import { drawer } from "./drawer.svelte";
  import { pastedName } from "$lib/data/pastedFile";

  const chat = $derived(tabs.state);

  const RAIL_WIDTH = 64;
  const PANEL_WIDTH = 300;
  const SESSION_ID_PREVIEW = 8;

  const NOTICE_KEYS: Record<CompatNotice, string> = {
    app_outdated: "COMPAT_APP_OUTDATED",
    server_outdated: "COMPAT_SERVER_OUTDATED",
    cli_outdated: "COMPAT_CLI_OUTDATED",
  };

  let expanded = $state(settings.sidebarExpanded);
  let renameTarget = $state<SessionInfo | null>(null);
  let deleteTarget = $state<SessionInfo | null>(null);
  let colorTarget = $state<SessionInfo | null>(null);
  let confirmCommand = $state<CommandOption | null>(null);
  let dismissed = $state<CompatNotice[]>([]);
  let rewindOpen = $state(false);
  let queuedId = $state<string | null>(null);
  let sharedLink = $state<{ url: string; filename: string } | null>(null);
  let visibilityOpen = $state(false);
  let sideHeight = $state(58);
  let sideDragging = $state(false);
  let dropOver = $state(false);
  let composerHeight = $state(0);

  const canAttach = $derived(!chat.sideOpen);

  const dialogOpen = $derived(
    renameTarget !== null ||
      deleteTarget !== null ||
      colorTarget !== null ||
      confirmCommand !== null ||
      rewindOpen ||
      queuedId !== null ||
      sharedLink !== null ||
      visibilityOpen ||
      navigation.preview !== null ||
      (layout.mobile && drawer.open),
  );

  const onPaste = (event: ClipboardEvent) => {
    if (event.defaultPrevented) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement) return;
    const files = Array.from(event.clipboardData?.files ?? []).map(pastedName);
    if (!files.length || !canAttach || dialogOpen) return;
    event.preventDefault();
    chat.addAttachments(files);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dropOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length && canAttach) chat.addAttachments(files);
  };

  const notices = $derived(serverStatus.notices.filter((notice) => !dismissed.includes(notice)));

  const selectTab = (id: string) => tabs.select(id);

  $effect(() => {
    layout.bottomInset = composerHeight;
    return () => (layout.bottomInset = 0);
  });

  $effect(() => {
    const environmentIds = [...new Set(tabs.list.map((tab) => tab.environmentId))];
    for (const id of environmentIds) {
      const sessions = chatListFor(backend.find(id))?.sessions;
      if (sessions?.length) tabs.applyLiveSessions(sessions);
    }
  });

  $effect(() => {
    tabs.updateActive({
      sessionId: chat.sessionId,
      projectKey: chat.projectKey,
      running: chat.streaming,
    });
    tabs.syncUrl();
  });

  const waitingUser = $derived(
    chat.messages.some((item) => item.interaction !== null && isPending(item.interaction)),
  );

  const status = $derived.by(() => {
    if (chat.connection === "disconnected") return { dot: "bg-red", spinner: false, text: t("SERVER_UNAVAILABLE") };
    if (chat.connection === "connecting") return { dot: "bg-gray", spinner: true, text: t("CONNECTING") };
    if (waitingUser) return { dot: "bg-orange", spinner: false, text: t("WAITING_USER") };
    if (chat.streaming) return { dot: "bg-gray", spinner: true, text: t("WORKING") };
    return {
      dot: "bg-green",
      spinner: false,
      text: chat.sessionId?.slice(0, SESSION_ID_PREVIEW) ?? t("NEW_CHAT"),
    };
  });

  const setExpanded = (value: boolean) => {
    expanded = value;
    settings.sidebarExpanded = value;
  };

  $effect(() => {
    if (!layout.mobile) drawer.open = false;
  });

  $effect(() =>
    navigation.intercept(() => {
      if (chat.sideOpen) {
        chat.closeSideChat();
        return true;
      }
      if (drawer.open) {
        drawer.open = false;
        return true;
      }
      return false;
    }),
  );
</script>

<svelte:window onpaste={onPaste} />

<div class="flex h-full">
  {#if !layout.mobile}
    <div
      class="h-full shrink-0 overflow-hidden bg-surface transition-[width] duration-200"
      style="width: {expanded ? PANEL_WIDTH : RAIL_WIDTH}px"
    >
      {#if expanded}
        <ChatPanel
          drawerMode={false}
          onClose={() => setExpanded(false)}
          onAfterSelect={() => {}}
          onRename={(session) => (renameTarget = session)}
          onColor={(session) => (colorTarget = session)}
          onDelete={(session) => (deleteTarget = session)}
        />
      {:else}
        <div class="flex h-full flex-col items-center border-r border-outline-variant py-2">
          <TooltipIconButton label={t("MENU")} onclick={() => setExpanded(true)}>
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
  {/if}

  <div class="flex min-w-0 flex-1 flex-col">
    {#if !layout.mobile}
      <TabStrip
        onSelect={(id) => selectTab(id)}
        onNew={() => tabs.newTab()}
        onClose={(id) => tabs.close(id)}
      />
    {/if}
    <AppTopBar
      title={t("APP_NAME")}
      subtitle={status.text}
      navigationIcon={layout.mobile ? menuButton : undefined}
    >
      {#snippet subtitleLeading()}
        {#if status.spinner}
          <LoadingIndicator size={8} fill />
        {:else}
          <StatusDot class={status.dot} box={8} />
        {/if}
      {/snippet}
      {#snippet actions()}
        {#if chat.sessionId !== null && !chat.streaming}
          <TooltipIconButton
            label={t("REWIND")}
            onclick={() => {
              rewindOpen = true;
              void chat.loadRewindPoints();
            }}
          >
            <History size={20} />
          </TooltipIconButton>
        {/if}
        <TaskIndicator todos={chat.todos} />
        {#if layout.mobile}
          <TabSwitcher />
        {/if}
        <TooltipIconButton label={t("NEW_SESSION")} onclick={() => chat.newSession()}>
          <SquarePen size={20} />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative flex min-h-0 flex-1 flex-col"
      ondragover={(event) => {
        event.preventDefault();
        dropOver = canAttach;
      }}
      ondragleave={(event) => {
        if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) dropOver = false;
      }}
      ondrop={onDrop}
    >
      <DropOverlay visible={dropOver} />
      <div class="relative min-h-0 flex-1">
        <div
          class="overflow-hidden {sideDragging
            ? ''
            : 'transition-[height] duration-[350ms] ease-[cubic-bezier(0.33,1,0.68,1)]'}"
          style="height: {chat.sideOpen ? Math.max(0, 100 - sideHeight) : 100}%"
        >
        <MessageList
        messages={chat.messages}
        pendingToolIds={chat.pendingToolIds}
        streaming={chat.streaming}
        compacting={chat.compacting}
        streamStatus={chat.streamStatus}
        visibility={{
          thinking: chat.showThinking,
          toolUse: chat.showToolUse,
          fileChange: chat.showFileChange,
          compact: chat.showCompact,
        }}
        onAnswer={(requestId, optionId) => chat.answerInteraction(requestId, optionId)}
        onLoadOlder={() => chat.loadOlder()}
        onFollowChange={(following) => (chat.followBottom = following)}
        onSharedLink={(url, filename) => (sharedLink = { url, filename })}
        {questions}
      />
        </div>
        {#if chat.sideOpen}
          <SidePanel
            messages={chat.sideMessages}
            height={sideHeight}
            onHeight={(value) => (sideHeight = value)}
            onDragging={(value) => (sideDragging = value)}
            onClear={() => chat.clearSideChat()}
            streaming={chat.sideStreaming}
            onClose={() => chat.closeSideChat()}
            onAnswer={(requestId, optionId) => chat.answerInteraction(requestId, optionId)}
            {questions}
          />
        {/if}
    </div>

    {#if notices.length}
      <div class="flex flex-col gap-1.5 px-3 pb-3">
        {#each notices as notice (notice)}
          <NoticeCard
            text={t(NOTICE_KEYS[notice])}
            actionLabel={t("SETTINGS")}
            onAction={() => {
              dismissed = [...dismissed, notice];
              navigation.openSettings(notice === "cli_outdated" ? "cli" : "about");
            }}
            onDismiss={() => (dismissed = [...dismissed, notice])}
          />
        {/each}
      </div>
    {/if}

    <div class="shrink-0" bind:clientHeight={composerHeight}>
    <Composer
      streaming={chat.sideOpen ? chat.sideStreaming : chat.streaming}
      draft={chat.sideOpen ? chat.sideDraft : chat.draft}
      onDraft={(value) => (chat.sideOpen ? (chat.sideDraft = value) : (chat.draft = value))}
      attachments={chat.sideOpen ? [] : chat.attachments}
      uploading={!chat.sideOpen && chat.uploading}
      queue={chat.sideOpen ? [] : chat.visibleQueue}
      onOpenQueued={(item) => (queuedId = item.id)}
      commands={chat.sessionId !== null && chat.connected && !chat.streaming
        ? (chat.capabilities?.commands ?? [])
        : []}
      pendingInput={chat.pendingInput}
      onConsumePending={() => chat.consumePendingInput()}
      onSend={(text) => (chat.sideOpen ? chat.sendSideQuestion(text) : chat.submit(text))}
      onCommand={(command) =>
        command.requireConfirmation ? (confirmCommand = command) : chat.runCommand(command)}
      onInterrupt={() => (chat.sideOpen ? chat.stopSide() : chat.interrupt())}
      onAttach={(files) => chat.addAttachments(files)}
      onRemoveAttachment={(id) => chat.removeAttachment(id)}
        onCloseSide={chat.sideOpen ? () => chat.closeSideChat() : null}
        sessionColor={chat.sessionColor}
        controls={chat.sideOpen ? undefined : controls}
      />
    </div>
    </div>
  </div>
</div>

{#snippet menuButton()}
  <TooltipIconButton label={t("MENU")} onclick={() => (drawer.open = true)}>
    <Menu size={20} />
  </TooltipIconButton>
{/snippet}

{#snippet controls()}
  <ChatToolbar
    capabilities={chat.capabilities}
    ready={chat.capabilitiesReady}
    connecting={chat.connection === "connecting"}
    disconnected={chat.connection === "disconnected"}
    model={chat.effectiveModel}
    modelSelected={chat.modelOverride}
    effort={chat.effectiveEffort}
    effortSelected={chat.effortOverride}
    permissionMode={chat.effectivePermissionMode}
    permissionSelected={chat.permissionOverride}
    account={chat.effectiveAccount}
    accountSelected={chat.accountOverride}
    onAccount={(value) => chat.setAccount(value)}
    streamTokens={chat.effectiveStreamTokens}
    contextTokens={chat.contextTokens}
    onModel={(value) => chat.setModel(value)}
    onEffort={(value) => chat.setEffort(value)}
    onPermissionMode={(value) => chat.setPermissionMode(value)}
    onStreamTokens={() => chat.toggleStreamTokens()}
    simpleMode={chat.effectiveVisibility.simple}
    onVisibility={() => (visibilityOpen = true)}
    onQuickChat={() => (chat.sideOpen ? chat.closeSideChat() : chat.openSideChat())}
    quickChatActive={chat.sideMessages.length > 0}
  />
{/snippet}

{#snippet questions(data: InteractionData)}
  <QuestionsBlock
    {data}
    onToggleOption={(index, optionId) => chat.toggleQuestionOption(data.requestId, index, optionId)}
    onFreeText={(index, value) => chat.setQuestionText(data.requestId, index, value)}
    onNotes={(index, value) => chat.setQuestionNotes(data.requestId, index, value)}
    onPage={(index) => chat.setActiveQuestion(data.requestId, index)}
    onSubmit={() => chat.submitQuestions(data.requestId)}
    onChat={() => chat.declineQuestions(data.requestId)}
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
  {@const current = chat.effectiveVisibility}
  <VisibilityDialog
    title={t("VISIBILITY_LOCAL")}
    quickChat={false}
    simple={current.simple}
    thinking={current.thinking}
    toolUse={current.tool_use}
    fileChange={current.file_change}
    compact={current.compact}
    working=""
    onConfirm={(values) => {
      chat.applyVisibility({
        simple: values.simple,
        thinking: values.thinking,
        tool_use: values.toolUse,
        file_change: values.fileChange,
        compact: values.compact,
      });
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
      navigation.openPreview({
        url: target.url,
        name: target.filename,
        onDelete: relative ? () => void sharedApi.remove(relative) : null,
      })}
    onOpenInFiles={relative && isArchive(target.filename) ? () => navigation.openExplorer(relative) : null}
    onDismiss={() => (sharedLink = null)}
  />
{/if}

{#if queuedId}
  {@const item = chat.queue.find((entry) => entry.id === queuedId) ?? null}
  {#if item}
    <CompactDialog title={t("QUEUED_MESSAGE")} onDismiss={() => (queuedId = null)}>
      {#snippet buttons()}
        <Button onclick={() => (queuedId = null)} variant="outlined">{t("CLOSE")}</Button>
      {/snippet}
      {#if item.text.trim()}
        <OutlinedPanel>
          <p class="selectable text-body-md whitespace-pre-wrap">{item.text}</p>
        </OutlinedPanel>
      {/if}
      {#if item.attachments.length}
        <div class="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
          {#each item.attachments as attachment (attachment)}
            {@const name = attachment.split("/").pop() ?? attachment}
            <Chip
              {name}
              icon={isArchive(name) ? FolderArchive : FileIcon}
              onclick={() => {
                queuedId = null;
                navigation.openPreview({ url: downloadUrl(`uploads/${name}`), name, onDelete: null });
              }}
            />
          {/each}
        </div>
      {/if}
    </CompactDialog>
  {/if}
{/if}

{#if layout.mobile}
  <Drawer
    open={drawer.open}
    onDismiss={() => (drawer.open = false)}
    onOpen={() => (drawer.open = true)}
  >
    <ChatPanel
      drawerMode
      onClose={layout.touch ? null : () => (drawer.open = false)}
      onAfterSelect={() => (drawer.open = false)}
      onRename={(session) => (renameTarget = session)}
      onColor={(session) => (colorTarget = session)}
      onDelete={(session) => (deleteTarget = session)}
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

{#if deleteTarget}
  {@const target = deleteTarget}
  <ConfirmDialog
    title={t("DELETE")}
    text={target.title ?? target.preview ?? target.sessionId}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      void chat.remove(target);
      deleteTarget = null;
    }}
    onDismiss={() => (deleteTarget = null)}
  />
{/if}
