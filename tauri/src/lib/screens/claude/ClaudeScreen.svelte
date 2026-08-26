<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Blocks from "@lucide/svelte/icons/blocks";
  import Brain from "@lucide/svelte/icons/brain";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import FilePen from "@lucide/svelte/icons/file-pen";
  import FileText from "@lucide/svelte/icons/file-text";
  import FolderPen from "@lucide/svelte/icons/folder-pen";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Server from "@lucide/svelte/icons/server";
  import Store from "@lucide/svelte/icons/store";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Wand from "@lucide/svelte/icons/wand";
  import { navigation } from "$lib/app/navigation.svelte";
  import { isTouch } from "$lib/platform";
  import { desktop } from "$lib/platform/desktop.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import type { ProjectInfo } from "$lib/data/models";
  import { formatDayTime, parseIsoMillis } from "$lib/data/time";
  import { settings } from "$lib/data/settings.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import { accountsApi, type AccountsSnapshot } from "$lib/services/accountsApi";
  import { claudeApi, type Extensions, type McpServer, type ServiceStatus, type Skill, type Usage } from "$lib/services/claudeApi";
  import { cliApi, type CliInfo } from "$lib/services/cliApi";
  import { settingsApi } from "$lib/services/settingsApi";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ClaudeIcon from "$lib/ui/ClaudeIcon.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AccountsSection from "./AccountsSection.svelte";
  import ClaudeDetail, { CLAUDE_KINDS, type ClaudeKind } from "./ClaudeDetail.svelte";
  import CliControls from "./CliControls.svelte";
  import PromptDialog from "./PromptDialog.svelte";
  import ProjectPromptDialog from "./ProjectPromptDialog.svelte";
  import { indicatorLabel, indicatorTone } from "./serviceStatus";

  const SUMMARY_LENGTH = 80;
  const MILLIS_PER_HOUR = 3_600_000;
  const MILLIS_PER_MINUTE = 60_000;
  const HOURS_PER_DAY = 24;

  let cli = $state<CliInfo | null>(null);
  let extensions = $state<Extensions | null>(null);
  let skills = $state<Skill[] | null>(null);
  let mcpServers = $state<McpServer[] | null>(null);
  let userPrompt = $state<string | null>(null);
  let usage = $state<Usage | null>(null);
  let accounts = $state<AccountsSnapshot | null>(null);
  let service = $state<ServiceStatus | null>(null);
  let projects = $state<ProjectInfo[]>([]);
  let loaded = $state(false);
  let refreshing = $state(false);
  // Which page is open lives in the URL, not here: back and reload both have to land on it.
  const detail = $derived(
    (CLAUDE_KINDS as readonly string[]).includes(navigation.sub ?? "") ? (navigation.sub as ClaudeKind) : null,
  );
  let envOpen = $state(false);
  let accountOpen = $state(false);
  let promptOpen = $state(false);
  let projectPromptOpen = $state(false);

  const chat = $derived(tabs.state);
  const environment = $derived(backend.active);
  const serverReady = $derived(backend.configured && chat.connected);

  const load = async () => {
    cli = await cliApi.status();
    extensions = await claudeApi.extensions();
    skills = await claudeApi.skills();
    mcpServers = await claudeApi.mcp();
    userPrompt = await claudeApi.userPrompt();
    projects = chatListFor(backend.active)?.projects ?? [];
    accounts = await accountsApi.list();
    usage = await claudeApi.usage(accounts?.default ?? null);
    service = await claudeApi.status();
    loaded = true;
    refreshing = false;
  };

  const usageWindowLabel = (id: string) =>
    id === "session" ? t("USAGE_SESSION") : id === "weekly_all" ? t("USAGE_ALL_MODELS") : id;

  const resetsLabel = (resetsAt: string | null) => {
    const millis = resetsAt === null ? null : parseIsoMillis(resetsAt);
    if (millis === null) return "—";
    const remaining = millis - Date.now();
    if (remaining <= 0) return "—";
    if (remaining < HOURS_PER_DAY * MILLIS_PER_HOUR) {
      const hours = Math.floor(remaining / MILLIS_PER_HOUR);
      const minutes = Math.floor((remaining % MILLIS_PER_HOUR) / MILLIS_PER_MINUTE);
      return t("RESETS_IN", hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
    }
    return t("RESETS_ON", formatDayTime(millis));
  };

  const promptSummary = $derived(
    userPrompt
      ?.split("\n")
      .find((line) => line.trim())
      ?.slice(0, SUMMARY_LENGTH) || t("USER_PROMPT_SUMMARY"),
  );

  const serviceSummary = $derived(
    !service ? "—" : service.error !== null ? t("STATUS_UNKNOWN") : indicatorLabel(service.indicator),
  );

  const loggedAccounts = $derived((accounts?.accounts ?? []).filter((account) => account.loggedIn));

  $effect(() => {
    void backend.activeId;
    loaded = false;
    void load();
  });

  $effect(() => {
    if (chat.connected) void load();
  });

  $effect(() => {
    if (desktop.refreshTick > 0) {
      refreshing = true;
      void load();
    }
  });

  // Leaving a page can have changed what this screen lists (a plugin installed, an MCP removed).
  let lastDetail: ClaudeKind | null = null;
  $effect(() => {
    const current = detail;
    if (lastDetail !== null && current === null) void load();
    lastDetail = current;
  });
</script>

{#if detail}
  <ClaudeDetail kind={detail} onClose={() => navigation.closeSub()} />
{:else}
  <div class="flex h-full flex-col">
    <AppTopBar
      title={t("CLAUDE")}
      subtitle={!serverReady && loaded ? t("SERVER_UNAVAILABLE") : (environment?.name ?? null)}
    >
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
          <ArrowLeft size={20} />
        </TooltipIconButton>
      {/snippet}
      {#snippet subtitleLeading()}
        {#if !serverReady && loaded}
          <StatusDot class="bg-red" box={8} />
        {/if}
      {/snippet}
      {#snippet actions()}
        {#if loggedAccounts.length > 1}
          <TooltipIconButton label={t("ACCOUNT")} onclick={() => (accountOpen = true)}>
            <CircleUser size={20} />
          </TooltipIconButton>
        {/if}
        <TooltipIconButton label={t("ENVIRONMENT")} enabled={!settings.environmentLocked} onclick={() => (envOpen = true)}>
          <Server size={20} />
        </TooltipIconButton>
        {#if !isTouch}
          <TooltipIconButton
            label={t("REFRESH")}
            onclick={() => {
              refreshing = true;
              void load();
            }}
          >
            <RotateCw size={20} />
          </TooltipIconButton>
        {/if}
      {/snippet}
    </AppTopBar>

    <PullToRefresh
      {refreshing}
      onRefresh={() => {
        refreshing = true;
        void load();
      }}
    >
      {#if !loaded}
        <CenteredProgress class="h-full" />
      {:else}
        <div class="px-4 pb-4">
        <SettingsGroup label={t("SERVICE_STATUS")}>
          {#snippet labelTrailing()}
            <StatusDot
              class={service && service.error === null ? indicatorTone(service.indicator) : "bg-gray"}
              box={20}
              dot={12}
            />
          {/snippet}
          <PreferenceRow
            icon={Activity}
            title={t("SERVICE_STATUS")}
            summary={serviceSummary}
            enabled={serverReady}
            onclick={() => navigation.openSub("status")}
          >
            {#snippet trailing()}
              <ChevronRight size={24} class="text-on-surface-variant" />
            {/snippet}
          </PreferenceRow>
        </SettingsGroup>

        <SettingsGroup label={t("CLI")}>
          <PreferenceRow
            icon={ClaudeIcon}
            title={t("CLI")}
            summary={cli?.activeVersion ?? "—"}
            enabled={serverReady}
          >
            {#snippet trailing()}
              <TooltipIconButton
                label={t("CHANGELOG")}
                enabled={serverReady}
                onclick={() => navigation.openSub("changelog")}
              >
                <FileText size={18} />
              </TooltipIconButton>
            {/snippet}
          </PreferenceRow>
          {#if cli}
            <CliControls info={cli} enabled={serverReady} onChanged={(value) => (cli = value)} />
          {/if}
          <PreferenceRow
            icon={FilePen}
            title={t("USER_PROMPT")}
            summary={promptSummary}
            enabled={serverReady}
            onclick={() => (promptOpen = true)}
          />
          {#if projects.length}
            <PreferenceRow
              icon={FolderPen}
              title={t("PROJECT_PROMPT")}
              summary={t("PROJECT_PROMPT_SUMMARY")}
              enabled={serverReady}
              onclick={() => (projectPromptOpen = true)}
            />
          {/if}
        </SettingsGroup>

        {#if usage && usage.error === null && usage.windows.length}
          {@const accountLabel =
            (accounts?.accounts.length ?? 0) > 1
              ? (accounts?.accounts.find((item) => item.id === accounts?.default)?.label ?? null)
              : null}
          {@const usageLabel = [accountLabel, usage.plan].filter(Boolean).join(" • ")}
          <SettingsGroup label={t("USAGE")}>
            {#snippet labelTrailing()}
              {#if usageLabel}
                <p class="text-label-lg text-on-surface-variant">{usageLabel}</p>
              {/if}
            {/snippet}
            <div class="flex flex-col gap-3.5 p-4">
              {#each usage.windows as window (window.id)}
                <MetricBar
                  title={usageWindowLabel(window.id)}
                  subtitle={resetsLabel(window.resetsAt)}
                  percent={window.percent}
                />
              {/each}
            </div>
          </SettingsGroup>
        {/if}

        <AccountsSection enabled={serverReady} onChanged={() => void load()} />

        <SettingsGroup label={t("EXTENSIONS")}>
          {@const enabledPlugins = extensions?.plugins.filter((item) => item.enabled).length ?? 0}
          {@render link(
            Blocks,
            t("PLUGINS"),
            extensions ? plural("ENABLED_COUNT", enabledPlugins, enabledPlugins, extensions.plugins.length) : "—",
            "plugins",
          )}
          {@render link(Wand, t("SKILLS"), skills ? String(skills.length) : "—", "skills")}
          {@render link(Unplug, t("MCP_SERVERS"), mcpServers ? String(mcpServers.length) : "—", "mcp")}
          {@render link(Store, t("MARKETPLACES"), extensions ? String(extensions.marketplaces.length) : "—", "marketplaces")}
          {@render link(
            Brain,
            t("MEMORIES"),
            chat.defaultProjectKey(projects) ?? chat.projectKey ?? "—",
            "memories",
          )}
        </SettingsGroup>
      </div>
      {/if}
    </PullToRefresh>
  </div>
{/if}

{#snippet link(icon: typeof Blocks, title: string, summary: string, kind: ClaudeKind)}
  <PreferenceRow {icon} {title} {summary} enabled={serverReady} onclick={() => navigation.openSub(kind)}>
    {#snippet trailing()}
      <ChevronRight size={24} class="text-on-surface-variant" />
    {/snippet}
  </PreferenceRow>
{/snippet}

{#if envOpen}
  <SelectDialog
    title={t("ENVIRONMENT")}
    options={backend.environments.map((profile) => ({
      value: profile.id,
      label: profile.name,
      subtitle: address(profile),
    }))}
    selected={backend.activeId ?? ""}
    onSelect={(id) => backend.select(id)}
    onDismiss={() => (envOpen = false)}
  />
{/if}

{#if accountOpen}
  <SelectDialog
    title={t("ACCOUNT")}
    options={loggedAccounts.map((account) => ({ value: account.id, label: account.label }))}
    selected={accounts?.default ?? ""}
    onSelect={(id) => {
      accountOpen = false;
      void settingsApi.update({ account: id }).then(load);
    }}
    onDismiss={() => (accountOpen = false)}
  />
{/if}

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
