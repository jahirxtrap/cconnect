<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import Eye from "@lucide/svelte/icons/eye";
  import Lock from "@lucide/svelte/icons/lock";
  import Shield from "@lucide/svelte/icons/shield";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Unplug from "@lucide/svelte/icons/unplug";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Server from "@lucide/svelte/icons/server";
  import { serverSettings } from "$lib/data/serverSettings.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { type SettingsPatch } from "$lib/services/settingsApi";
  import { systemApi, type ServerUpdate } from "$lib/services/systemApi";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import ChatsDialog from "./ChatsDialog.svelte";
  import GenerationDialog from "./GenerationDialog.svelte";
  import PrivacyDialog from "./PrivacyDialog.svelte";
  import { entryFor, entryHint, type SettingsDialog } from "./settingsIndex";
  import { useSettingsDialog } from "./useSettingsDialog.svelte";
  import ToolsDialog from "./ToolsDialog.svelte";
  import VisibilityDialog from "./VisibilityDialog.svelte";

  interface Props {
    tick?: number;
    flash?: boolean;
    onLoadingChange?: (value: boolean) => void;
  }

  const { tick = 0, flash = false, onLoadingChange }: Props = $props();

  let dialog = $state<SettingsDialog | null>(null);
  let repo = $state<ServerUpdate | null>(null);
  let checkingUpdate = $state(false);
  let updating = $state(false);
  let pulled = $state(false);

  const version = $derived(serverStatus.version?.serverVersion ?? null);

  const versionSummary = $derived(
    [version ? t("VERSION_LABEL", version) : null, repo?.revision || null].filter(Boolean).join(" • "),
  );

  const updateAvailable = $derived((repo?.behind ?? 0) > 0);
  const serverModified = $derived((repo?.ahead ?? 0) > 0 || repo?.dirty === true);

  const updateLabel = $derived(
    updating
      ? t("SERVER_UPDATING")
      : updateAvailable
        ? t("UPDATE_ACTION")
        : checkingUpdate
          ? t("CHECKING_UPDATES")
          : t("CHECK_UPDATES"),
  );

  const checkUpdate = async () => {
    checkingUpdate = true;
    pulled = false;
    const result = await systemApi.checkUpdate();
    checkingUpdate = false;
    if (result) repo = result;
  };

  const runUpdate = async () => {
    updating = true;
    const result = await systemApi.update();
    updating = false;
    pulled = true;
    if (result) repo = result;
  };

  const snapshot = $derived(serverSettings.snapshot);
  const capabilities = $derived(serverSettings.capabilities);
  const loading = $derived(serverSettings.loading);
  const ready = $derived(serverSettings.ready);

  const load = async () => {
    onLoadingChange?.(true);
    await serverSettings.load();
    if (backend.configured) repo = await systemApi.updateStatus();
    onLoadingChange?.(false);
  };

  const rowSummary = (id: string) => {
    if (!ready) return loading ? t("CONNECTING") : t("SERVER_UNAVAILABLE");
    const entry = entryFor(id);
    return entry ? entryHint(entry) : "";
  };

  const apply = async (patch: SettingsPatch) => {
    dialog = null;
    await serverSettings.update(patch);
  };

  $effect(() => {
    void backend.activeId;
    void tabs.state.connected;
    void tick;
    void load();
  });

  useSettingsDialog("server", (target) => (dialog = target));
</script>

<SettingsGroup label={t("SETTINGS_SERVER")}>
  {#snippet labelTrailing()}
    {#if loading}
      <LoadingIndicator size={20} />
    {:else}
      <StatusDot class={ready ? "bg-green" : "bg-red"} box={20} dot={12} />
    {/if}
  {/snippet}

  <PreferenceRow
    icon={Sparkles}
    title={t("GENERATION")}
    summary={rowSummary("generation")}
    enabled={ready}
    onclick={() => (dialog = "generation")}
  />

  <PreferenceRow
    icon={Unplug}
    title={t("TOOLS")}
    summary={rowSummary("tools")}
    enabled={ready}
    onclick={() => (dialog = "tools")}
  />

  <PreferenceRow
    icon={Shield}
    title={t("PERMISSIONS")}
    summary={rowSummary("permissions")}
    enabled={ready}
    onclick={() => (dialog = "permissions")}
  />

  <PreferenceRow
    icon={Lock}
    title={t("PRIVACY")}
    summary={rowSummary("privacy")}
    enabled={ready}
    onclick={() => (dialog = "privacy")}
  />

  <PreferenceRow
    icon={Eye}
    title={t("VISIBILITY")}
    summary={rowSummary("visibility")}
    enabled={ready}
    onclick={() => (dialog = "visibility")}
  />

  <PreferenceRow
    icon={MessagesSquare}
    title={t("CHATS")}
    summary={rowSummary("chats")}
    enabled={ready}
    onclick={() => (dialog = "chats")}
  />

  {#if (capabilities?.accounts.length ?? 0) > 1}
    <PreferenceRow
      icon={CircleUser}
      title={t("ACCOUNT")}
      summary={rowSummary("account")}
      enabled={ready}
      onclick={() => (dialog = "account")}
    />
  {/if}

  <div
    class="flex w-full items-center gap-3 px-4 py-3 {ready ? '' : 'opacity-40'} {flash
      ? 'flash-highlight'
      : ''}"
  >
    <Server size={18} class="shrink-0 text-on-surface-variant" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-body-md">{t("SERVER_VERSION")}</p>
      <p class="truncate text-body-sm text-on-surface-variant">
        {ready ? versionSummary : loading ? t("CONNECTING") : t("SERVER_UNAVAILABLE")}
      </p>
      {#if ready && serverStatus.serverOutdated}
        <p class="text-body-sm text-red">{t("COMPAT_SERVER_OUTDATED")}</p>
      {/if}
      {#if updateAvailable}
        <p class="text-body-sm text-accent">{plural("SERVER_BEHIND", repo?.behind ?? 0)}</p>
      {:else if pulled && repo?.changed && !repo.reloads}
        <p class="text-body-sm text-accent">{t("SERVER_UPDATE_RESTART")}</p>
      {:else if repo?.tracked && repo.ok}
        <p class="text-body-sm text-on-surface-variant">
          {serverModified ? t("SERVER_MODIFIED") : t("UP_TO_DATE")}
        </p>
      {/if}
    </div>
  </div>

  {#if !repo || repo.tracked}
    <div class="px-4 py-3">
      <ActionButton
        class="w-full"
        text={updateLabel}
        enabled={ready && !checkingUpdate && !updating}
        onclick={() => void (updateAvailable ? runUpdate() : checkUpdate())}
      />
      {#if repo?.message && !repo.ok}
        <p
          class="mt-2.5 rounded-md border-2 border-red px-2.5 py-2 font-mono text-body-sm whitespace-pre-wrap text-red"
        >
          {repo.message}
        </p>
      {/if}
    </div>
  {/if}
</SettingsGroup>

{#if dialog === "generation" && snapshot && capabilities}
  <GenerationDialog
    {capabilities}
    model={snapshot.model}
    effort={snapshot.effort}
    outputStyle={snapshot.outputStyle}
    streaming={snapshot.streaming}
    todoTools={snapshot.todoTools}
    chatLanguage={snapshot.chatLanguage}
    alwaysThinking={snapshot.alwaysThinking}
    autoCompact={snapshot.autoCompact}
    onConfirm={(values) =>
      void apply({
        model: values.model,
        effort: values.effort,
        output_style: values.outputStyle,
        streaming: values.streaming,
        todo_tools: values.todoTools,
        chat_language: values.chatLanguage,
        always_thinking: values.alwaysThinking,
        auto_compact: values.autoCompact,
      })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "tools" && snapshot && capabilities}
  <ToolsDialog
    tools={capabilities.mcpTools}
    disabled={snapshot.mcpDisabled}
    browserView={snapshot.browserView}
    onConfirm={(mcp_disabled, browser_view) => void apply({ mcp_disabled, browser_view })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "permissions" && snapshot}
  <SelectDialog
    title={t("PERMISSION_MODE")}
    options={(capabilities?.permissionModes ?? []).map((item) => ({ value: item.id, label: item.label }))}
    selected={snapshot.permissionMode}
    onSelect={(value) => void apply({ permission_mode: value })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "visibility" && snapshot}
  <VisibilityDialog
    simple={snapshot.simpleMode ? "on" : "off"}
    thinking={snapshot.showThinking}
    toolUse={snapshot.showToolUse}
    fileChange={snapshot.showFileChange}
    compact={snapshot.showCompact}
    working={snapshot.showWorking}
    tokens={snapshot.showTokens ? "on" : "off"}
    onConfirm={(values) =>
      void apply({
        simple_mode: values.simple === "on",
        show_thinking: values.thinking,
        show_tool_use: values.toolUse,
        show_file_change: values.fileChange,
        show_compact: values.compact,
        show_working: values.working,
        show_tokens: values.tokens === "on",
      })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "chats" && snapshot}
  <ChatsDialog
    trashEnabled={snapshot.trashEnabled}
    retentionDays={snapshot.retentionDays}
    retentionMin={snapshot.retentionMin}
    retentionMax={snapshot.retentionMax}
    onConfirm={(trash_enabled, retention_days) => void apply({ trash_enabled, retention_days })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "privacy" && snapshot}
  <PrivacyDialog
    remoteControl={snapshot.remoteControl}
    coAuthored={snapshot.coAuthored}
    sessionUpload={snapshot.sessionUpload}
    onConfirm={(values) =>
      void apply({
        remote_control: values.remoteControl,
        co_authored: values.coAuthored,
        session_upload: values.sessionUpload,
      })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "account" && snapshot}
  <SelectDialog
    title={t("ACCOUNT")}
    options={(capabilities?.accounts ?? []).map((item) => ({ value: item.id, label: item.label }))}
    selected={snapshot.account}
    onSelect={(value) => void apply({ account: value })}
    onDismiss={() => (dialog = null)}
  />
{/if}
