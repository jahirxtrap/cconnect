<script lang="ts">
  import FilePen from "@lucide/svelte/icons/file-pen";
  import FileText from "@lucide/svelte/icons/file-text";
  import FolderPen from "@lucide/svelte/icons/folder-pen";
  import { t } from "$lib/i18n/index.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { claudeApi } from "$lib/services/claudeApi";
  import { cliApi, type CliInfo } from "$lib/services/cliApi";
  import { claudeChangelog } from "$lib/services/githubApi";
  import ChangelogDialog from "$lib/ui/ChangelogDialog.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
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

  const SUMMARY_LENGTH = 60;

  let cli = $state<CliInfo | null>(null);
  let userPrompt = $state<string | null>(null);
  let promptOpen = $state(false);
  let projectPromptOpen = $state(false);
  let changelog = $state<string | null | undefined>(undefined);

  const chat = $derived(tabs.state);
  const projects = $derived(chatListFor(backend.active)?.projects ?? []);

  const promptSummary = $derived(
    userPrompt
      ?.split("\n")
      .find((line) => line.trim())
      ?.slice(0, SUMMARY_LENGTH) || t("USER_PROMPT_SUMMARY"),
  );

  $effect(() => {
    void tick;
    void backend.activeId;
    void cliApi.status().then((value) => (cli = value));
    void claudeApi.userPrompt().then((value) => (userPrompt = value));
  });
</script>

<SettingsGroup label={t("CLI")}>
  <PreferenceRow icon={ClaudeIcon} title={t("CLI")} summary={cli?.activeVersion ?? pending} {enabled} {flash}>
    {#snippet trailing()}
      <TooltipIconButton
        label={t("CHANGELOG")}
        {enabled}
        onclick={() => (changelog = cli?.activeVersion ?? null)}
      >
        <FileText size={18} />
      </TooltipIconButton>
    {/snippet}
  </PreferenceRow>
  {#if cli}
    <CliControls info={cli} {enabled} onChanged={(value) => (cli = value)} />
  {/if}
  <PreferenceRow
    icon={FilePen}
    title={t("USER_PROMPT")}
    summary={promptSummary}
    {enabled}
    onclick={() => (promptOpen = true)}
  />
  {#if projects.length}
    <PreferenceRow
      icon={FolderPen}
      title={t("PROJECT_PROMPT")}
      summary={t("PROJECT_PROMPT_SUMMARY")}
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
        if (ok) userPrompt = text;
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

{#if changelog !== undefined}
  {@const version = changelog}
  <ChangelogDialog
    load={() => claudeChangelog(version)}
    limitHeight={false}
    onDismiss={() => (changelog = undefined)}
  />
{/if}
