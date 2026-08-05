<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import Eye from "@lucide/svelte/icons/eye";
  import FileText from "@lucide/svelte/icons/file-text";
  import Shield from "@lucide/svelte/icons/shield";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { capabilitiesApi, type Capabilities } from "$lib/services/capabilitiesApi";
  import { cliApi, type CliInfo } from "$lib/services/cliApi";
  import { settingsApi, type SettingsSnapshot } from "$lib/services/settingsApi";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import CliDialog from "./CliDialog.svelte";
  import GenerationDialog from "./GenerationDialog.svelte";
  import VisibilityDialog from "./VisibilityDialog.svelte";

  interface Props {
    onChangelog: (cliVersion: string | null) => void;
  }

  const { onChangelog }: Props = $props();

  type Dialog = "cli" | "generation" | "permissions" | "visibility" | "account";

  let snapshot = $state<SettingsSnapshot | null>(null);
  let capabilities = $state<Capabilities | null>(null);
  let cli = $state<CliInfo | null>(null);
  let loading = $state(true);
  let dialog = $state<Dialog | null>(null);

  const ready = $derived(snapshot !== null);

  const load = async () => {
    loading = true;
    capabilities = await capabilitiesApi.capabilities();
    snapshot = await settingsApi.get();
    cli = await cliApi.status();
    loading = false;
  };

  const summary = (real: string) => (ready ? real : loading ? t("CONNECTING") : t("SERVER_UNAVAILABLE"));

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

  $effect(() => {
    void backend.activeId;
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
    streaming={snapshot.streaming}
    onConfirm={(model, effort, streaming) => void apply({ model, effort, streaming })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "permissions" && snapshot}
  <SelectDialog
    title={t("PERMISSIONS")}
    options={(capabilities?.permissionModes ?? []).map((item) => ({ value: item.id, label: item.label }))}
    selected={snapshot.permissionMode}
    onSelect={(value) => void apply({ permission_mode: value })}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "visibility" && snapshot}
  <VisibilityDialog
    thinking={snapshot.showThinking}
    toolUse={snapshot.showToolUse}
    fileChange={snapshot.showFileChange}
    compact={snapshot.showCompact}
    working={snapshot.showWorking}
    onConfirm={(values) =>
      void apply({
        show_thinking: values.thinking,
        show_tool_use: values.toolUse,
        show_file_change: values.fileChange,
        show_compact: values.compact,
        show_working: values.working,
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
