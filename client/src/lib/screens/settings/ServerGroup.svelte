<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import Eye from "@lucide/svelte/icons/eye";
  import Lock from "@lucide/svelte/icons/lock";
  import Shield from "@lucide/svelte/icons/shield";
  import Flame from "@lucide/svelte/icons/flame";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Unplug from "@lucide/svelte/icons/unplug";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Puzzle from "@lucide/svelte/icons/puzzle";
  import Server from "@lucide/svelte/icons/server";
  import { joined } from "$lib/data/format";
  import { loads } from "$lib/data/inflight";
  import { serverSettings } from "$lib/data/serverSettings.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { useAgents } from "$lib/services/agents.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { localServer } from "$lib/services/localServer.svelte";
  import { type SettingsPatch } from "$lib/services/settingsApi";
  import { systemApi, type ServerUpdate } from "$lib/services/systemApi";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import { PREFERENCE_ICON_SIZE, PREFERENCE_ROW_CLASS } from "$lib/ui/preferenceRow";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import AgentsDialog from "$lib/screens/agents/AgentsDialog.svelte";
  import ChatsDialog from "./ChatsDialog.svelte";
  import GenerationDialog from "./GenerationDialog.svelte";
  import PrivacyDialog from "./PrivacyDialog.svelte";
  import SessionsDialog from "./SessionsDialog.svelte";
  import { entryFor, entryHint, type SettingsDialog } from "./settingsIndex";
  import { useSettingsDialog } from "./useSettingsDialog.svelte";
  import ToolsDialog from "./ToolsDialog.svelte";
  import VisibilityDialog from "./VisibilityDialog.svelte";

  interface Props {
    tick?: number;
    flash?: boolean;
  }

  const { tick = 0, flash = false }: Props = $props();

  useAgents();

  let dialog = $state<SettingsDialog | null>(null);
  let repo = $state<ServerUpdate | null>(null);
  let checkingUpdate = $state(false);
  let updating = $state(false);
  let failure = $state<string | null>(null);

  const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

  const version = $derived(serverStatus.version?.serverVersion ?? null);

  const versionSummary = $derived(
    joined(version ? t("VERSION_LABEL", version) : null, repo?.revision),
  );

  const packaged = $derived(repo?.source === "package");
  const updateAvailable = $derived(packaged ? !!repo?.latest : (repo?.behind ?? 0) > 0);
  const serverModified = $derived((repo?.ahead ?? 0) > 0 || repo?.dirty === true);

  const localInfo = $derived(localServer.info);
  const managedHere = $derived(
    localServer.native &&
      localInfo.managed &&
      LOCAL_HOSTS.includes((backend.active?.host ?? "").toLowerCase()) &&
      (backend.active?.port ?? 0) === localInfo.port,
  );

  const applyUpdate = async () => {
    if (!repo?.changed || repo.reloads) return;
    if (packaged && managedHere) localServer.restart();
    else await systemApi.restart();
  };

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
    failure = null;
    repo = await systemApi.checkUpdate();
    checkingUpdate = false;
  };

  const runUpdate = async () => {
    updating = true;
    if (packaged && managedHere) {
      const output = await localServer.update();
      updating = false;
      repo = await systemApi.checkUpdate();
      failure = output === null ? t("SERVER_UPDATE_FAILED") : null;
      if (!failure) await applyUpdate();
      return;
    }
    const result = await systemApi.update();
    updating = false;
    if (result) repo = result;
    await applyUpdate();
  };

  const snapshot = $derived(serverSettings.snapshot);
  const capabilities = $derived(serverSettings.capabilities);
  const loading = $derived(serverSettings.loading);
  const ready = $derived(serverSettings.ready);

  const load = () =>
    loads.track(
      (async () => {
        await serverSettings.load();
        if (backend.configured) await checkUpdate();
      })(),
    );

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

  const highlight = useSettingsDialog("server", (target) => (dialog = target));
</script>

<SettingsGroup label={t("SETTINGS_SERVER")}>
  {#snippet labelTrailing()}
    <StatusDot class={ready ? "bg-green" : "bg-red"} {loading} />
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
    icon={Bot}
    title={t("AGENTS")}
    summary={rowSummary("agents")}
    enabled={ready}
    onclick={() => (dialog = "agents")}
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

  <PreferenceRow
    icon={Flame}
    title={t("SESSIONS")}
    summary={rowSummary("sessions")}
    enabled={ready}
    onclick={() => (dialog = "sessions")}
  />

  {#if snapshot && snapshot.modSurfaces !== null}
    {@const modsOn = snapshot.modSurfaces}
    <PreferenceRow
      icon={Puzzle}
      title={t("MODS")}
      summary={rowSummary("mod_surfaces")}
      enabled={ready}
      flash={highlight.is("mod_surfaces")}
      onclick={() => void apply({ mod_surfaces: !modsOn })}
    >
      {#snippet trailing()}
        <CompactSwitch checked={modsOn} onCheckedChange={(value) => void apply({ mod_surfaces: value })} />
      {/snippet}
    </PreferenceRow>
  {/if}

  {#if (capabilities?.accounts.length ?? 0) > 1}
    <PreferenceRow
      icon={CircleUser}
      title={t("ACCOUNT")}
      summary={rowSummary("account")}
      enabled={ready}
      onclick={() => (dialog = "account")}
    />
  {/if}

  <div class="{PREFERENCE_ROW_CLASS} {ready ? '' : 'opacity-40'} {flash ? 'flash-highlight' : ''}">
    <Server size={PREFERENCE_ICON_SIZE} class="shrink-0 text-on-surface-variant" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-item-title">{t("SERVER_VERSION")}</p>
      <p class="truncate text-body-sm text-on-surface-variant">
        {ready ? versionSummary : loading ? t("CONNECTING") : t("SERVER_UNAVAILABLE")}
      </p>
      {#if ready && serverStatus.serverOutdated}
        <ErrorText text={t("COMPAT_SERVER_OUTDATED")} />
      {/if}
      {#if updateAvailable}
        <p class="text-body-sm text-accent">
          {packaged ? t("UPDATE_AVAILABLE", repo?.latest ?? "") : plural("SERVER_BEHIND", repo?.behind ?? 0)}
        </p>
      {:else if repo && !repo.ok}
        <p class="text-body-sm text-on-surface-variant">{t("UPDATE_CHECK_FAILED")}</p>
      {:else if (repo?.tracked || packaged) && repo?.ok}
        <p class="text-body-sm text-on-surface-variant">
          {serverModified ? t("SERVER_MODIFIED") : t("UP_TO_DATE")}
        </p>
      {/if}
    </div>
  </div>

  {#if !repo || repo.tracked || packaged}
    <div class="px-4 py-3">
      <ActionButton
        class="w-full"
        text={updateLabel}
        enabled={ready && !checkingUpdate && !updating}
        onclick={() => void (updateAvailable ? runUpdate() : checkUpdate())}
      />
      {#if failure}
        <ErrorText text={failure} class="mt-2.5" />
      {:else if repo?.message && !repo.ok}
        <ErrorText text={repo.message} class="mt-2.5" />
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
    autoCompactWindow={snapshot.autoCompactWindow}
    compactMin={snapshot.autoCompactWindowMin}
    compactMax={snapshot.autoCompactWindowMax}
    instructionFiles={snapshot.instructionFiles}
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
        ...(snapshot.autoCompactWindowMin !== null ? { auto_compact_window: values.autoCompactWindow } : {}),
        ...(snapshot.instructionFiles !== null ? { instruction_files: values.instructionFiles } : {}),
      })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "tools" && snapshot && capabilities}
  <ToolsDialog
    tools={capabilities.mcpTools}
    disabled={snapshot.mcpDisabled}
    browserView={snapshot.browserView}
    suggestions={snapshot.suggestions}
    onConfirm={(mcp_disabled, browser_view, suggestions) =>
      void apply({ mcp_disabled, browser_view, suggestions })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "agents"}
  <AgentsDialog onDismiss={() => (dialog = null)} />
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
    timings={snapshot.showToolTime ? "on" : "off"}
    onConfirm={(values) =>
      void apply({
        simple_mode: values.simple === "on",
        show_thinking: values.thinking,
        show_tool_use: values.toolUse,
        show_file_change: values.fileChange,
        show_compact: values.compact,
        show_working: values.working,
        show_tokens: values.tokens === "on",
        show_tool_time: values.timings === "on",
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
{:else if dialog === "sessions" && snapshot}
  <SessionsDialog
    persistent={snapshot.persistentSessions}
    grace={snapshot.sessionGrace}
    limit={snapshot.sessionLimit}
    onConfirm={(persistent_sessions, session_grace, session_limit) =>
      void apply({ persistent_sessions, session_grace, session_limit })}
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
