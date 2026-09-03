<script lang="ts">
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import History from "@lucide/svelte/icons/history";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import Trash from "@lucide/svelte/icons/trash";
  import type { Snippet } from "svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { type InteractionData } from "$lib/data/chatModels";
  import { isArchive } from "$lib/data/format";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { onNativePaste } from "$lib/platform/pastedContent";
  import { backend } from "$lib/services/backend.svelte";
  import type { CommandOption } from "$lib/services/capabilitiesApi";
  import { downloadUrl, relativeFromUrl, sharedApi } from "$lib/services/sharedApi";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import Chip from "$lib/ui/Chip.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import { dragTransfer, dropZone } from "$lib/app/dragPayload.svelte";
  import DropOverlay from "$lib/ui/DropOverlay.svelte";
  import { hasFiles } from "$lib/ui/fileDrop";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import SharedLinkActionsDialog from "$lib/ui/SharedLinkActionsDialog.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import VisibilityDialog from "$lib/screens/settings/VisibilityDialog.svelte";
  import ComponentBlock from "./blocks/ComponentBlock.svelte";
  import ChatToolbar from "./ChatToolbar.svelte";
  import Composer from "./Composer.svelte";
  import MessageList from "./MessageList.svelte";
  import RewindDialog from "./RewindDialog.svelte";
  import SidePanel from "./SidePanel.svelte";
  import TabSwitcher from "./TabSwitcher.svelte";
  import TaskIndicator from "./TaskIndicator.svelte";
  import { tabs, type Tab } from "./tabs.svelte";
  import { drawer } from "./drawer.svelte";
  import { pastedName } from "$lib/data/pastedFile";

  interface Props {
    tab: Tab;
    primary?: boolean;
    focused?: boolean;
    switcherCwd?: string[];
    transfersLift?: number;
    instant?: boolean;
    navigationIcon?: Snippet;
    notices?: Snippet;
    onComposerHeight?: (height: number) => void;
  }

  const {
    tab,
    primary = false,
    focused = true,
    switcherCwd = [],
    transfersLift = 0,
    instant = false,
    navigationIcon,
    notices,
    onComposerHeight,
  }: Props = $props();

  const SIDE_PEEK = 58;
  const SESSION_ID_PREVIEW = 8;

  const chat = $derived(tabs.stateFor(tab));

  let confirmCommand = $state<CommandOption | null>(null);
  let rewindOpen = $state(false);
  let purgeViewOpen = $state(false);
  let queuedId = $state<string | null>(null);
  let sharedLink = $state<{ url: string; filename: string } | null>(null);
  let visibilityOpen = $state(false);
  let sideHeight = $state(SIDE_PEEK);
  let sideDragging = $state(false);
  let dropOver = $state(false);
  let dropRoot = $state<HTMLElement | null>(null);
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
    onComposerHeight?.(composerHeight);
  });

  const canAttach = $derived(!chat.sideOpen);

  const dialogOpen = $derived(
    confirmCommand !== null ||
      rewindOpen ||
      queuedId !== null ||
      sharedLink !== null ||
      visibilityOpen ||
      navigation.preview !== null ||
      (layout.mobile && drawer.open),
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

  const onDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dropOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length && canAttach) chat.addAttachments(files);
  };

  const activity = $derived(
    chat.activity ??
      chatListFor(backend.find(chat.environmentId))?.sessions.find(
        (session) => session.sessionId === chat.sessionId,
      )?.activity ??
      null,
  );
  const busy = $derived(
    chat.streaming || ["waiting", "working", "slow", "compacting"].includes(activity ?? ""),
  );

  const availableCommands = $derived.by(() => {
    const all = chat.capabilities?.commands ?? [];
    if (chat.sideOpen || !chat.connected || busy) return [];
    return chat.sessionId !== null ? all : all.filter((command) => command.kind === "usage");
  });

  const viewLabel = $derived(
    chat.viewOnly ? (chat.viewOnly.title ?? chat.viewOnly.sessionId.slice(0, SESSION_ID_PREVIEW)) : "",
  );

  $effect(() => {
    tabs.update(tab.id, {
      sessionId: chat.sessionId,
      projectKey: chat.projectKey,
      running: busy,
      viewTitle: chat.viewOnly ? viewLabel : null,
    });
    tabs.syncUrl();
  });

  const status = $derived.by(() => {
    if (chat.viewOnly) return { dot: "bg-gray", spinner: false, text: t("TRASH") };
    if (chat.link === "disconnected") return { dot: "bg-red", spinner: false, text: t("SERVER_UNAVAILABLE") };
    if (chat.link === "connecting") return { dot: "bg-gray", spinner: true, text: t("CONNECTING") };
    if (activity === "waiting") return { dot: "bg-orange", spinner: false, text: t("WAITING_USER") };
    if (activity === "compacting") return { dot: "bg-gray", spinner: true, tone: "text-blue", text: t("COMPACTING") };
    if (activity === "slow") return { dot: "bg-gray", spinner: true, tone: "text-yellow", text: t("WORKING") };
    if (activity === "working") return { dot: "bg-gray", spinner: true, text: t("WORKING") };
    if (activity === "failed")
      return {
        dot: "bg-red",
        spinner: false,
        text: chat.sessionId?.slice(0, SESSION_ID_PREVIEW) ?? t("NEW_CHAT"),
      };
    return {
      dot: "bg-green",
      spinner: false,
      text: chat.sessionId?.slice(0, SESSION_ID_PREVIEW) ?? t("NEW_CHAT"),
    };
  });

  $effect(() =>
    navigation.intercept(() => {
      if (!chat.sideOpen) return false;
      closeSide();
      return true;
    }),
  );
</script>

<svelte:window onpaste={onPaste} />

<AppTopBar title={t("APP_NAME")} subtitle={status.text} {navigationIcon}>
  {#snippet subtitleLeading()}
    {#if status.spinner}
      <LoadingIndicator size={8} fill class={"tone" in status ? status.tone : undefined} />
    {:else}
      <StatusDot class={status.dot} box={8} />
    {/if}
  {/snippet}
  {#snippet actions()}
    {#if chat.viewOnly}
      <TooltipIconButton label={t("RESTORE")} onclick={() => void chat.restoreViewOnly()}>
        <RotateCcw size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("DELETE")} onclick={() => (purgeViewOpen = true)}>
        <Trash size={20} />
      </TooltipIconButton>
    {:else}
      {#if chat.sessionId !== null && !busy}
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
    {/if}
    {#if layout.mobile && primary}
      <TabSwitcher cwd={switcherCwd} />
    {/if}
    <TooltipIconButton
      label={t("NEW_SESSION")}
      onclick={() => (chat.viewOnly ? chat.closeViewOnly() : chat.newSession())}
    >
      <SquarePen size={20} />
    </TooltipIconButton>
  {/snippet}
</AppTopBar>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={dropRoot}
  use:dropZone={{
    accepts: (payload) => payload.files.length > 0 && !chat.viewOnly && canAttach,
    drop: (payload) => chat.addSharedAttachments(payload.files),
  }}
  class="relative flex min-h-0 flex-1 flex-col"
  ondragover={(event) => {
    if (chat.viewOnly || !hasFiles(event)) return;
    event.preventDefault();
    dropOver = canAttach;
  }}
  ondragleave={(event) => {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) dropOver = false;
  }}
  ondrop={onDrop}
>
  <DropOverlay visible={dropOver || dragTransfer.over === dropRoot} />
  <div class="relative min-h-0 flex-1 overflow-hidden">
    {#if opening}
      <CenteredProgress class="absolute inset-0 z-10" />
    {/if}
    <div
      class="overflow-hidden {opening ? 'opacity-0' : ''} {sideDragging || instant
        ? ''
        : 'transition-[height] duration-[350ms] ease-[cubic-bezier(0.33,1,0.68,1)]'}"
      style="height: {chat.sideOpen ? Math.max(0, 100 - sideHeight) : 100}%"
    >
      <MessageList
        messages={chat.view}
        pendingToolIds={chat.pendingToolIds}
        streaming={chat.streaming}
        compacting={chat.compacting || activity === "compacting"}
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
        tabId={tab.id}
        expandedIds={chat.expandedIds}
        savedScroll={{ top: chat.scrollTop, follow: chat.followBottom }}
        onScrollTop={(top, following) => {
          chat.scrollTop = top;
          chat.followBottom = following;
        }}
        {component}
        bottomInset={transfersLift}
      />
    </div>
    {#if chat.sideOpen}
      <SidePanel
        messages={chat.showWorking === "label" ? chat.sideMessages : chat.sideMessages.filter((item) => item.role !== "working")}
        height={sideHeight}
        {instant}
        onHeight={(value) => (sideHeight = value)}
        onDragging={(value) => (sideDragging = value)}
        onClear={() => chat.clearSideChat()}
        streaming={chat.sideStreaming}
        onClose={closeSide}
        onAnswer={(requestId, optionId) => chat.answerInteraction(requestId, optionId)}
        {component}
        bottomInset={transfersLift}
      />
    {/if}
  </div>

  {@render notices?.()}

  {#if !chat.viewOnly}
    <div class="shrink-0" bind:clientHeight={composerHeight}>
      <Composer
        {focused}
        blocked={chat.link === "disconnected"}
        streaming={chat.sideOpen ? chat.sideStreaming : busy}
        draft={chat.sideOpen ? chat.sideDraft : chat.draft}
        onDraft={(value) => (chat.sideOpen ? (chat.sideDraft = value) : (chat.draft = value))}
        attachments={chat.sideOpen ? [] : chat.attachments}
        uploading={!chat.sideOpen && chat.uploading}
        queue={chat.sideOpen ? [] : chat.visibleQueue}
        onOpenQueued={(item) => (queuedId = item.id)}
        commands={availableCommands}
        pendingInput={chat.pendingInput}
        onConsumePending={() => chat.consumePendingInput()}
        onSend={(text) => (chat.sideOpen ? chat.sendSideQuestion(text) : chat.submit(text))}
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
  <ChatToolbar
    capabilities={chat.capabilities}
    ready={chat.capabilitiesReady}
    connecting={chat.link === "connecting"}
    disconnected={chat.link === "disconnected"}
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
    contextTokens={chat.contextView}
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
    onPreviewOpen={(url, filename) => (sharedLink = { url, filename })}
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
    }}
    simple={local.simple === null ? "" : local.simple ? "on" : "off"}
    thinking={local.thinking ?? ""}
    toolUse={local.tool_use ?? ""}
    fileChange={local.file_change ?? ""}
    compact={local.compact ?? ""}
    working={local.working ?? ""}
    tokens={local.tokens === null ? "" : local.tokens ? "on" : "off"}
    onConfirm={(values) => {
      tabs.applyVisibility({
        simple: values.simple === "" ? null : values.simple === "on",
        thinking: values.thinking || null,
        tool_use: values.toolUse || null,
        file_change: values.fileChange || null,
        compact: values.compact || null,
        working: values.working || null,
        tokens: values.tokens === "" ? null : values.tokens === "on",
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
  {@const item = chat.queueView.find((entry) => entry.id === queuedId) ?? null}
  {#if item}
    <CompactDialog title={t("QUEUED_MESSAGE")} onDismiss={() => (queuedId = null)}>
      {#snippet buttons()}
        <Button onclick={() => (queuedId = null)} variant="outlined">{t("CANCEL")}</Button>
      {/snippet}
      {#if item.text.trim()}
        <OutlinedPanel>
          <p class="selectable text-body-md wrap-anywhere whitespace-pre-wrap">{item.text}</p>
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

{#if purgeViewOpen && chat.viewOnly}
  {@const target = chat.viewOnly}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_CONVERSATION_CONFIRM", target.title ?? target.sessionId.slice(0, SESSION_ID_PREVIEW))}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      void chat.purgeViewOnly();
      purgeViewOpen = false;
    }}
    onDismiss={() => (purgeViewOpen = false)}
  />
{/if}
