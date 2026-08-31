<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import Eye from "@lucide/svelte/icons/eye";
  import FileText from "@lucide/svelte/icons/file-text";
  import Shield from "@lucide/svelte/icons/shield";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Unplug from "@lucide/svelte/icons/unplug";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { capabilitiesApi, type Capabilities } from "$lib/services/capabilitiesApi";
  import { cliApi, type CliInfo } from "$lib/services/cliApi";
  import { settingsApi, type SettingsSnapshot } from "$lib/services/settingsApi";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChatsDialog from "./ChatsDialog.svelte";
  import CliDialog from "./CliDialog.svelte";
  import GenerationDialog from "./GenerationDialog.svelte";
  import McpToolsDialog from "./McpToolsDialog.svelte";
  import VisibilityDialog from "./VisibilityDialog.svelte";

  interface Props {
    tick?: number;
    flash?: boolean;
    onLoadingChange?: (value: boolean) => void;
    onChangelog: (cliVersion: string | null) => void;
  }

  const { tick = 0, flash = false, onLoadingChange, onChangelog }: Props = $props();

  type Dialog = "cli" | "generation" | "permissions" | "visibility" | "account" | "mcpTools" | "chats";

  let snapshot = $state<SettingsSnapshot | null>(null);
  let capabilities = $state<Capabilities | null>(null);
  let cli = $state<CliInfo | null>(null);
  let loading = $state(true);
  let dialog = $state<Dialog | null>(null);

  const ready = $derived(snapshot !== null);

  const load = async () => {
    loading = true;
    onLoadingChange?.(true);
    if (!backend.configured) {
      snapshot = null;
      cli = null;
      loading = false;
      onLoadingChange?.(false);
      return;
    }
    capabilities = await capabilitiesApi.capabilities();
    snapshot = await settingsApi.get();
    cli = await cliApi.status();
    loading = false;
    onLoadingChange?.(false);
  };

  const summary = (real: string) => (ready ? real : loading ? t("CONNECTING") : t("SERVER_UNAVAILABLE"));

  const hiddenTools = $derived(
    new Set((snapshot?.mcpDisabled ?? "").split(",").map((name) => name.trim()).filter(Boolean)),
  );
  const enabledTools = $derived(
    (capabilities?.mcpTools ?? []).filter((tool) => !hiddenTools.has(tool.name)).length,
  );

  const apply = async (patch: Parameters<typeof settingsApi.update>[0]) => {
    dialog = null;
    const result = await settingsApi.update(patch);
    if (result) snapshot = result;
  };

  const modelLabel = $derived(
    capabilities?.models.find((item) => item.id === snapshot?.model)?.label ?? snapshot?.model ?? "—",
  );
  const permissionLabel = $derived(
    capabilities?.permissionModes.find((item) => item.id === snapshot?.permissionMode)?.label ??
      snapshot?.permissionMode ??
      "—",
  );
  const accountLabel = $derived(
    capabilities?.accounts.find((item) => item.id === snapshot?.account)?.label ?? snapshot?.account ?? "—",
  );
  const chatsSummary = $derived(
    [
      t(snapshot?.trashEnabled ? "TRASH_ON" : "TRASH_OFF"),
      plural("RETENTION_DAYS_SUMMARY", snapshot?.retentionDays ?? 30),
    ].join(" • "),
  );

  $effect(() => {
    void backend.activeId;
    void tabs.state.connected;
    void tick;
    void load();
  });
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
    icon={ClaudeIcon}
    title={t("CLI")}
    summary={summary(cli?.activeVersion ?? "—")}
    enabled={ready}
    {flash}
    onclick={() => (dialog = "cli")}
  >
    {#snippet trailing()}
      <TooltipIconButton
        label={t("CHANGELOG")}
        enabled={ready}
        onclick={() => onChangelog(cli?.activeVersion ?? null)}
      >
        <FileText size={20} />
      </TooltipIconButton>
    {/snippet}
  </PreferenceRow>

  <PreferenceRow
    icon={Sparkles}
    title={t("GENERATION")}
    summary={summary(`${modelLabel} • ${snapshot?.effort ?? "—"}`)}
    enabled={ready}
    onclick={() => (dialog = "generation")}
  />

  <PreferenceRow
    icon={Unplug}
    title={t("MCP_TOOLS")}
    summary={summary(
      capabilities
        ? t("MCP_TOOLS_COUNT", enabledTools, capabilities.mcpTools.length)
        : "—",
    )}
    enabled={ready}
    onclick={() => (dialog = "mcpTools")}
  />

  <PreferenceRow
    icon={Shield}
    title={t("PERMISSIONS")}
    summary={summary(permissionLabel)}
    enabled={ready}
    onclick={() => (dialog = "permissions")}
  />

  <PreferenceRow
    icon={Eye}
    title={t("VISIBILITY")}
    summary={summary(t("VISIBILITY_SUMMARY"))}
    enabled={ready}
    onclick={() => (dialog = "visibility")}
  />

  <PreferenceRow
    icon={MessagesSquare}
    title={t("CHATS")}
    summary={summary(chatsSummary)}
    enabled={ready}
    onclick={() => (dialog = "chats")}
  />

  {#if (capabilities?.accounts.length ?? 0) > 1}
    <PreferenceRow
      icon={CircleUser}
      title={t("ACCOUNT")}
      summary={summary(accountLabel)}
      enabled={ready}
      onclick={() => (dialog = "account")}
    />
  {/if}
</SettingsGroup>

{#if dialog === "cli" && cli}
  <CliDialog
    info={cli}
    onChanged={(value) => {
      cli = value;
      dialog = null;
    }}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "generation" && snapshot && capabilities}
  <GenerationDialog
    {capabilities}
    model={snapshot.model}
    effort={snapshot.effort}
    outputStyle={snapshot.outputStyle}
    streaming={snapshot.streaming}
    todoTools={snapshot.todoTools}
    onConfirm={(model, effort, output_style, streaming, todo_tools) =>
      void apply({ model, effort, output_style, streaming, todo_tools })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "mcpTools" && snapshot && capabilities}
  <McpToolsDialog
    tools={capabilities.mcpTools}
    disabled={snapshot.mcpDisabled}
    onConfirm={(mcp_disabled) => void apply({ mcp_disabled })}
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
    onConfirm={(trash_enabled, retention_days) => void apply({ trash_enabled, retention_days })}
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
