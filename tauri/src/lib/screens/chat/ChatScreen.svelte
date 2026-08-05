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
  import type { SessionInfo } from "$lib/data/models";
  import { serverStatus, type CompatNotice } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { downloadUrl, relativeFromUrl, sharedApi } from "$lib/services/sharedApi";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Chip from "$lib/ui/Chip.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import Drawer from "$lib/ui/Drawer.svelte";
  import NoticeCard from "$lib/ui/NoticeCard.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SharedLinkActionsDialog from "$lib/ui/SharedLinkActionsDialog.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChatPanel from "./ChatPanel.svelte";
  import ChatToolbar from "./ChatToolbar.svelte";
  import Composer from "./Composer.svelte";
  import MessageList from "./MessageList.svelte";
  import QuestionsBlock from "./blocks/QuestionsBlock.svelte";
  import RewindDialog from "./RewindDialog.svelte";
  import SidePanel from "./SidePanel.svelte";
  import TabStrip from "./TabStrip.svelte";
  import TabSwitcher from "./TabSwitcher.svelte";
  import TaskIndicator from "./TaskIndicator.svelte";
  import { tabs } from "./tabs.svelte";

  const chat = $derived(tabs.state);

  const RAIL_WIDTH = 64;
  const PANEL_WIDTH = 300;
  const SESSION_ID_PREVIEW = 8;

  const NOTICE_KEYS: Record<CompatNotice, string> = {
    app_outdated: "COMPAT_APP_OUTDATED",
    server_outdated: "COMPAT_SERVER_OUTDATED",
    cli_outdated: "COMPAT_CLI_OUTDATED",
  };

  let drawer = $state(false);
  let expanded = $state(settings.sidebarExpanded);
  let renameTarget = $state<SessionInfo | null>(null);
  let deleteTarget = $state<SessionInfo | null>(null);
  let dismissed = $state<CompatNotice[]>([]);
  let rewindOpen = $state(false);
  let queuedId = $state<string | null>(null);
  let sharedLink = $state<{ url: string; filename: string } | null>(null);
  let sideHeight = $state(45);
  let dropOver = $state(false);

  const canAttach = $derived(!chat.sideOpen);

  const onPaste = (event: ClipboardEvent) => {
    if (event.defaultPrevented) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement) return;
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length || !canAttach) return;
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
    if (!layout.mobile) drawer = false;
  });
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
          onColor={() => {}}
          onDelete={(session) => (deleteTarget = session)}
        />
      {:else}
        <div class="flex h-full flex-col items-center py-2">
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
    <AppTopBar title={t("APP_NAME")} subtitle={status.text}>
      {#snippet navigationIcon()}
        {#if layout.mobile}
          <TooltipIconButton label={t("MENU")} onclick={() => (drawer = true)}>
            <Menu size={20} />
          </TooltipIconButton>
        {/if}
      {/snippet}
      {#snippet subtitleLeading()}
        {#if status.spinner}
          <span class="size-3.5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
        {:else}
          <StatusDot class={status.dot} />
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
      class="relative flex min-h-0 flex-1 flex-col {dropOver ? 'drop-ring' : ''}"
      ondragover={(event) => {
        event.preventDefault();
        dropOver = canAttach;
      }}
      ondragleave={(event) => {
        if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) dropOver = false;
      }}
      ondrop={onDrop}
    >
      <div class="min-h-0 flex-1">
        <MessageList
        messages={chat.messages}
        pendingToolIds={chat.pendingToolIds}
        loadingOlder={chat.transcriptLoading}
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
        onSharedLink={(url, filename) => (sharedLink = { url, filename })}
        {questions}
      />
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

    {#if chat.sideOpen}
      <SidePanel
        messages={chat.sideMessages}
        height={sideHeight}
        onHeight={(value) => (sideHeight = value)}
        onClear={() => chat.clearSideChat()}
        onClose={() => chat.closeSideChat()}
        onAnswer={(requestId, optionId) => chat.answerSideInteraction(requestId, optionId)}
        {questions}
      />
    {/if}

    <Composer
      streaming={chat.sideOpen ? chat.sideStreaming : chat.streaming}
      draft={chat.sideOpen ? chat.sideDraft : chat.draft}
      onDraft={(value) => (chat.sideOpen ? (chat.sideDraft = value) : (chat.draft = value))}
      attachments={chat.sideOpen ? [] : chat.attachments}
      uploading={!chat.sideOpen && chat.uploading}
      queue={chat.sideOpen ? [] : chat.visibleQueue}
      onOpenQueued={(item) => (queuedId = item.id)}
      commands={chat.capabilities?.commands ?? []}
      pendingInput={chat.pendingInput}
      onConsumePending={() => chat.consumePendingInput()}
      onSend={(text) => (chat.sideOpen ? chat.sendSideQuestion(text) : void chat.submit(text))}
      onInterrupt={() => (chat.sideOpen ? chat.stopSide() : chat.interrupt())}
      onAttach={(files) => chat.addAttachments(files)}
      onRemoveAttachment={(id) => chat.removeAttachment(id)}
        onCloseSide={chat.sideOpen ? () => chat.closeSideChat() : null}
        {controls}
      />
    </div>
  </div>
</div>

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
    streamTokens={chat.effectiveStreamTokens}
    contextTokens={chat.contextTokens}
    onModel={(value) => chat.setModel(value)}
    onEffort={(value) => chat.setEffort(value)}
    onPermissionMode={(value) => chat.setPermissionMode(value)}
    onStreamTokens={() => chat.toggleStreamTokens()}
    onQuickChat={() => (chat.sideOpen ? chat.closeSideChat() : chat.openSideChat())}
    quickChatEnabled={chat.sessionId !== null && chat.connected}
    quickChatActive={chat.sideOpen}
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
    onRewind={(mode) => {
      void chat.rewind(mode);
      rewindOpen = false;
    }}
    onDismiss={() => {
      chat.dismissRewind();
      rewindOpen = false;
    }}
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
  <Drawer open={drawer} width={PANEL_WIDTH} onDismiss={() => (drawer = false)}>
    <ChatPanel
      drawerMode
      onClose={layout.touch ? null : () => (drawer = false)}
      onAfterSelect={() => (drawer = false)}
      onRename={(session) => (renameTarget = session)}
      onColor={() => {}}
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
