<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Blocks from "@lucide/svelte/icons/blocks";
  import Brain from "@lucide/svelte/icons/brain";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Server from "@lucide/svelte/icons/server";
  import Store from "@lucide/svelte/icons/store";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Wand from "@lucide/svelte/icons/wand";
  import { navigation } from "$lib/app/navigation.svelte";
  import { useHighlight } from "$lib/app/useHighlight.svelte";
  import { isTouch } from "$lib/platform";
  import { useRefreshTick } from "$lib/platform/useRefreshTick.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { projectNameOf, type ProjectInfo } from "$lib/data/models";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import { accountsApi, type AccountsSnapshot } from "$lib/services/accountsApi";
  import { claudeApi, type Extensions, type McpServer, type ServiceStatus, type Skill } from "$lib/services/claudeApi";
  import { settingsApi } from "$lib/services/settingsApi";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AccountsSection from "./AccountsSection.svelte";
  import ClaudeCliSection from "./ClaudeCliSection.svelte";
  import ClaudeDetail, { CLAUDE_KINDS, type ClaudeKind } from "./ClaudeDetail.svelte";
  import ClaudeUsageSection from "./ClaudeUsageSection.svelte";
  import { indicatorLabel, indicatorTone } from "./serviceStatus";

  let extensions = $state<Extensions | null>(null);
  let skills = $state<Skill[] | null>(null);
  let mcpServers = $state<McpServer[] | null>(null);
  let service = $state<ServiceStatus | null>(null);
  let accounts = $state<AccountsSnapshot | null>(null);
  let projects = $state<ProjectInfo[]>([]);
  let loaded = $state(false);
  let refreshing = $state(false);
  let refreshStarted = 0;
  let serviceLoading = $state(true);
  const detail = $derived(
    (CLAUDE_KINDS as readonly string[]).includes(navigation.sub ?? "") ? (navigation.sub as ClaudeKind) : null,
  );
  let envOpen = $state(false);
  let accountOpen = $state(false);
  const highlight = useHighlight();

  const chat = $derived(tabs.state);
  const environment = $derived(backend.active);
  const serverReady = $derived(backend.configured && chat.connected);

  const LOAD_DEBOUNCE_MS = 60;

  let sequence = 0;
  let tick = $state(0);
  let pendingLoad: ReturnType<typeof setTimeout> | null = null;

  const scheduleLoad = () => {
    if (pendingLoad !== null) clearTimeout(pendingLoad);
    pendingLoad = setTimeout(() => {
      pendingLoad = null;
      tick++;
      void load();
    }, LOAD_DEBOUNCE_MS);
  };

  const MIN_REFRESH_MS = 600;

  const refresh = () => {
    if (refreshing) return;
    refreshing = true;
    refreshStarted = Date.now();
    scheduleLoad();
  };

  const load = async () => {
    const current = ++sequence;
    serviceLoading = true;
    projects = chatListFor(backend.active)?.projects ?? [];
    await Promise.allSettled([
      claudeApi.extensions().then((value) => (extensions = value)),
      claudeApi.skills().then((value) => (skills = value)),
      claudeApi.mcp().then((value) => (mcpServers = value)),
      claudeApi
        .status()
        .then((value) => (service = value))
        .finally(() => (serviceLoading = false)),
      accountsApi.list().then((value) => (accounts = value)),
    ]);
    if (current !== sequence) return;
    loaded = true;
    if (refreshing) {
      const elapsed = Date.now() - refreshStarted;
      if (elapsed < MIN_REFRESH_MS) await new Promise((done) => setTimeout(done, MIN_REFRESH_MS - elapsed));
      if (current !== sequence) return;
    }
    refreshing = false;
  };

  const pending = $derived(loaded && !serverReady ? t("SERVER_UNAVAILABLE") : t("LOADING"));

  const serviceSummary = $derived(
    !service ? pending : service.error !== null ? t("STATUS_UNKNOWN") : indicatorLabel(service.indicator),
  );

  const loggedAccounts = $derived((accounts?.accounts ?? []).filter((account) => account.loggedIn));

  $effect(() => {
    void backend.activeId;
    loaded = false;
    scheduleLoad();
  });

  $effect(() => {
    if (chat.connected) scheduleLoad();
  });

  useRefreshTick(refresh);

  let lastDetail: ClaudeKind | null = null;
  $effect(() => {
    const current = detail;
    if (lastDetail !== null && current === null) scheduleLoad();
    lastDetail = current;
  });

  $effect(() => () => {
    if (pendingLoad !== null) clearTimeout(pendingLoad);
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
            shortcut="window.refresh"
            onclick={refresh}
          >
            <RotateCw size={20} />
          </TooltipIconButton>
        {/if}
      {/snippet}
    </AppTopBar>

    <PullToRefresh {refreshing} onRefresh={refresh}>
      <div class="px-4 pb-4">
        <SettingsGroup label={t("SERVICE_STATUS")}>
          {#snippet labelTrailing()}
            {#if serviceLoading}
              <LoadingIndicator size={20} />
            {:else if !service}
              <StatusDot class="bg-gray" box={20} dot={12} />
            {:else}
              <StatusDot
                class={service.error === null ? indicatorTone(service.indicator) : "bg-gray"}
                box={20}
                dot={12}
              />
            {/if}
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

        <ClaudeCliSection enabled={serverReady} {tick} {pending} flash={highlight.is("cli")} />

        <ClaudeUsageSection {tick} {pending} />

        <AccountsSection enabled={serverReady} onChanged={refresh} />

        <SettingsGroup label={t("EXTENSIONS")}>
          {@const enabledPlugins = extensions?.plugins.filter((item) => item.enabled).length ?? 0}
          {@render link(
            Blocks,
            t("PLUGINS"),
            extensions ? t("ENABLED_COUNT", enabledPlugins, extensions.plugins.length) : pending,
            "plugins",
          )}
          {@render link(Wand, t("SKILLS"), skills ? String(skills.length) : pending, "skills")}
          {@const enabledServers = mcpServers?.filter((item) => item.enabled).length ?? 0}
          {@render link(
            Unplug,
            t("MCP_SERVERS"),
            mcpServers ? t("ENABLED_COUNT", enabledServers, mcpServers.length) : pending,
            "mcp",
          )}
          {@render link(Store, t("MARKETPLACES"), extensions ? String(extensions.marketplaces.length) : pending, "marketplaces")}
          {@const memoryProject = chat.defaultProjectKey(projects) ?? chat.projectKey}
          {@render link(
            Brain,
            t("MEMORIES"),
            memoryProject ? projectNameOf(projects, memoryProject, chat.cwd) : loaded ? "—" : pending,
            "memories",
          )}
        </SettingsGroup>
      </div>
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
    selected={chat.environmentId ?? ""}
    onSelect={(id) => chat.selectEnvironment(id)}
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

