<script lang="ts">
  import FilePen from "@lucide/svelte/icons/file-pen";
  import FileText from "@lucide/svelte/icons/file-text";
  import FolderPen from "@lucide/svelte/icons/folder-pen";
  import Package from "@lucide/svelte/icons/package";
  import { t } from "$lib/i18n/index.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { serverSettings } from "$lib/data/serverSettings.svelte";
  import { claudeApi } from "$lib/services/claudeApi";
  import { cliApi } from "$lib/services/cliApi";
  import { entryFor, entryHint } from "$lib/screens/settings/settingsIndex";
  import { useSettingsDialog } from "$lib/screens/settings/useSettingsDialog.svelte";
  import { claudeChangelog, sdkChangelog } from "$lib/services/githubApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import ChangelogDialog from "$lib/ui/ChangelogDialog.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import CliControls from "./CliControls.svelte";
  import ProjectPromptDialog from "./ProjectPromptDialog.svelte";
  import PromptDialog from "./PromptDialog.svelte";

  interface Props {
    enabled: boolean;
    tick?: number;
    pending: string;
    flash?: boolean;
  }

  const { enabled, tick = 0, pending, flash = false }: Props = $props();

  let sdkUpdating = $state(false);
  let promptOpen = $state(false);
  let projectPromptOpen = $state(false);

  useSettingsDialog("claude", (target) => {
    if (target === "user_prompt") promptOpen = true;
    if (target === "project_prompt") projectPromptOpen = true;
  });
  let changelog = $state<{ sdk: boolean; version: string | null } | null>(null);

  const cli = $derived(claudeStatus.cli);
  const sdkAutoUpdate = $derived(serverSettings.snapshot?.sdkAutoUpdate ?? true);
  const userPrompt = $derived(claudeStatus.userPrompt);

  const updateSdk = async () => {
    sdkUpdating = true;
    const result = await cliApi.updateSdk();
    sdkUpdating = false;
    if (result) claudeStatus.sdk = result;
  };

  const setSdkAutoUpdate = (value: boolean) => {
    void serverSettings.update({ sdk_auto_update: value });
  };

  const chat = $derived(tabs.state);
  const projects = $derived(chatListFor(backend.active)?.projects ?? []);

  const rowSummary = (id: string) => {
    const entry = entryFor(id);
    const hint = entry ? entryHint(entry) : "";
    return hint || pending;
  };

  $effect(() => {
    void tick;
    void backend.activeId;
    void claudeStatus.loadCli();
    void serverSettings.load();
  });
</script>

<SettingsGroup label={t("CLI")}>
  <PreferenceRow icon={ClaudeIcon} title={t("CLI")} summary={rowSummary("cli")} {enabled} {flash}>
    {#snippet trailing()}
      <TooltipIconButton
        label={t("CHANGELOG")}
        {enabled}
        onclick={() => (changelog = { sdk: false, version: cli?.activeVersion ?? null })}
      >
        <FileText size={18} />
      </TooltipIconButton>
    {/snippet}
  </PreferenceRow>
  {#if cli}
    <CliControls info={cli} {enabled} onChanged={(value) => (claudeStatus.cli = value)} />
  {/if}
  <PreferenceRow icon={Package} title={t("SDK")} summary={rowSummary("sdk")} {enabled}>
    {#snippet trailing()}
      <TooltipIconButton
        label={t("CHANGELOG")}
        {enabled}
        onclick={() => (changelog = { sdk: true, version: claudeStatus.sdk?.version ?? null })}
      >
        <FileText size={18} />
      </TooltipIconButton>
    {/snippet}
  </PreferenceRow>
  <div class="flex flex-col gap-2.5 px-4 py-3">
    <SwitchRow
      title={t("SDK_AUTO_UPDATE")}
      summary={t("SDK_AUTO_UPDATE_SUMMARY")}
      checked={sdkAutoUpdate}
      {enabled}
      onChange={setSdkAutoUpdate}
    />
    <ActionButton
      text={sdkUpdating ? t("SDK_UPDATING") : t("SDK_UPDATE")}
      enabled={enabled && !sdkUpdating}
      onclick={() => void updateSdk()}
      class="w-full"
    />
  </div>
  <PreferenceRow
    icon={FilePen}
    title={t("USER_PROMPT")}
    summary={rowSummary("user_prompt")}
    {enabled}
    onclick={() => (promptOpen = true)}
  />
  {#if projects.length}
    <PreferenceRow
      icon={FolderPen}
      title={t("PROJECT_PROMPT")}
      summary={rowSummary("project_prompt")}
      {enabled}
      onclick={() => (projectPromptOpen = true)}
    />
  {/if}
</SettingsGroup>

{#if promptOpen}
  <PromptDialog
    initial={userPrompt ?? ""}
    title={t("USER_PROMPT")}
    summary={t("USER_PROMPT_SUMMARY")}
    onConfirm={(text) => {
      promptOpen = false;
      void claudeApi.setUserPrompt(text).then((ok) => {
        if (ok) claudeStatus.userPrompt = text;
      });
    }}
    onDismiss={() => (promptOpen = false)}
  />
{/if}

{#if projectPromptOpen && projects.length}
  {@const options = chat.withDefaultProject(projects)}
  <ProjectPromptDialog
    projects={options}
    initialProject={chat.defaultProjectKey(projects) ?? chat.projectKey ?? options[0].projectKey}
    onSave={(project, text) => {
      projectPromptOpen = false;
      void claudeApi.setProjectPrompt(project, text);
    }}
    onDismiss={() => (projectPromptOpen = false)}
  />
{/if}

{#if changelog}
  {@const notes = changelog}
  <ChangelogDialog
    load={() => (notes.sdk ? sdkChangelog(notes.version) : claudeChangelog(notes.version))}
    limitHeight={false}
    onDismiss={() => (changelog = null)}
  />
{/if}
