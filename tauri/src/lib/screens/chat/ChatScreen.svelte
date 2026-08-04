<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import Folder from "@lucide/svelte/icons/folder";
  import Menu from "@lucide/svelte/icons/menu";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import Settings from "@lucide/svelte/icons/settings";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Type from "@lucide/svelte/icons/type";
  import { navigation } from "$lib/app/navigation.svelte";
  import { isPending, type InteractionData, type QueuedMessage } from "$lib/data/chatModels";
  import type { SessionInfo } from "$lib/data/models";
  import { serverStatus, type CompatNotice } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import Drawer from "$lib/ui/Drawer.svelte";
  import NoticeCard from "$lib/ui/NoticeCard.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChatPanel from "./ChatPanel.svelte";
  import ChatToolbar from "./ChatToolbar.svelte";
  import Composer from "./Composer.svelte";
  import MessageList from "./MessageList.svelte";
  import QueueRow from "./QueueRow.svelte";
  import QuestionsBlock from "./blocks/QuestionsBlock.svelte";
  import RewindDialog from "./RewindDialog.svelte";
  import TaskIndicator from "./TaskIndicator.svelte";
  import { chatState } from "./state.svelte";

  chatState.start();

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
  let queuePreview = $state<QueuedMessage | null>(null);

  const notices = $derived(serverStatus.notices.filter((notice) => !dismissed.includes(notice)));

  const waitingUser = $derived(
    chatState.messages.some((item) => item.interaction !== null && isPending(item.interaction)),
  );

  const status = $derived.by(() => {
    if (chatState.connection === "disconnected") return { dot: "bg-red", spinner: false, text: t("SERVER_UNAVAILABLE") };
    if (chatState.connection === "connecting") return { dot: "bg-gray", spinner: true, text: t("CONNECTING") };
    if (waitingUser) return { dot: "bg-orange", spinner: false, text: t("WAITING_USER") };
    if (chatState.streaming) return { dot: "bg-gray", spinner: true, text: t("WORKING") };
    return {
      dot: "bg-green",
      spinner: false,
      text: chatState.sessionId?.slice(0, SESSION_ID_PREVIEW) ?? t("NEW_CHAT"),
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
          <TooltipIconButton label={t("NEW_SESSION")} onclick={() => chatState.newSession()}>
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
        <TaskIndicator todos={chatState.todos} />
      {/snippet}
    </AppTopBar>

    <div class="min-h-0 flex-1">
      <MessageList
        messages={chatState.messages}
        pendingToolIds={chatState.pendingToolIds}
        loadingOlder={chatState.transcriptLoading}
        onAnswer={(requestId, optionId) => chatState.answerInteraction(requestId, optionId)}
        onLoadOlder={() => chatState.loadOlder()}
        {questions}
      />
    </div>

    {#if notices.length}
      <div class="flex flex-col gap-1.5 px-3 pb-3">
        {#each notices as notice (notice)}
          <NoticeCard
            text={t(NOTICE_KEYS[notice])}
            actionLabel={t("SETTINGS")}
            onAction={() => navigation.openSettings()}
            onDismiss={() => (dismissed = [...dismissed, notice])}
          />
        {/each}
      </div>
    {/if}

    {#if chatState.visibleQueue.length}
      <QueueRow queue={chatState.visibleQueue} onOpen={(item) => (queuePreview = item)} />
    {/if}

    <Composer
      streaming={chatState.streaming}
      attachments={chatState.attachments}
      uploading={chatState.uploading}
      commands={chatState.capabilities?.commands ?? []}
      pendingInput={chatState.pendingInput}
      onConsumePending={() => chatState.consumePendingInput()}
      onSend={(text) => void chatState.submit(text)}
      onInterrupt={() => chatState.interrupt()}
      onAttach={(files) => chatState.addAttachments(files)}
      onRemoveAttachment={(id) => chatState.removeAttachment(id)}
      {controls}
    />
  </div>
</div>

{#snippet controls()}
  <ChatToolbar
    capabilities={chatState.capabilities}
    model={chatState.model}
    effort={chatState.effort}
    permissionMode={chatState.permissionMode}
    streamTokens={chatState.streamTokens}
    contextTokens={chatState.contextTokens}
    onModel={(value) => chatState.setModel(value)}
    onEffort={(value) => chatState.setEffort(value)}
    onPermissionMode={(value) => chatState.setPermissionMode(value)}
    onStreamTokens={() => chatState.toggleStreamTokens()}
    onRewind={() => {
      rewindOpen = true;
      void chatState.loadRewindPoints();
    }}
  />
{/snippet}

{#snippet questions(data: InteractionData)}
  <QuestionsBlock
    {data}
    onToggleOption={(index, optionId) => chatState.toggleQuestionOption(data.requestId, index, optionId)}
    onFreeText={(index, value) => chatState.setQuestionText(data.requestId, index, value)}
    onNotes={(index, value) => chatState.setQuestionNotes(data.requestId, index, value)}
    onPage={(index) => chatState.setActiveQuestion(data.requestId, index)}
    onSubmit={() => chatState.submitQuestions(data.requestId)}
    onChat={() => chatState.declineQuestions(data.requestId)}
  />
{/snippet}

{#if rewindOpen}
  <RewindDialog
    points={chatState.rewindPoints}
    loading={chatState.rewindLoading}
    target={chatState.rewindTarget}
    preview={chatState.rewindPreview}
    busy={chatState.rewindBusy}
    onSelect={(point) => void chatState.selectRewindPoint(point)}
    onRewind={(mode) => {
      void chatState.rewind(mode);
      rewindOpen = false;
    }}
    onDismiss={() => {
      chatState.dismissRewind();
      rewindOpen = false;
    }}
  />
{/if}

{#if queuePreview}
  {@const item = queuePreview}
  <CompactDialog title={t("QUEUED_MESSAGE")} onDismiss={() => (queuePreview = null)}>
    {#snippet buttons()}
      <Button
        onclick={() => {
          chatState.removeQueued(item.id);
          queuePreview = null;
        }}
      >
        {t("DELETE")}
      </Button>
      <Button onclick={() => (queuePreview = null)}>{t("CLOSE")}</Button>
    {/snippet}
    {#if item.text}
      <OutlinedPanel>
        <p class="text-body-md whitespace-pre-wrap">{item.text}</p>
      </OutlinedPanel>
    {/if}
  </CompactDialog>
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
      void chatState.rename(target, title);
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
      void chatState.remove(target);
      deleteTarget = null;
    }}
    onDismiss={() => (deleteTarget = null)}
  />
{/if}
