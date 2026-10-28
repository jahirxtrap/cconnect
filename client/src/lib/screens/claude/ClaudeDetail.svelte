<script lang="ts" module>
  import Activity from "@lucide/svelte/icons/activity";
  import Blocks from "@lucide/svelte/icons/blocks";
  import Brain from "@lucide/svelte/icons/brain";
  import Store from "@lucide/svelte/icons/store";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Wand from "@lucide/svelte/icons/wand";
  import type { IconSource } from "$lib/ui/icons";

  export const CLAUDE_KINDS = [
    "plugins",
    "skills",
    "mcp",
    "marketplaces",
    "memories",
    "status",
  ] as const;

  export type ClaudeKind = (typeof CLAUDE_KINDS)[number];

  export const CLAUDE_TABS: Record<ClaudeKind, string> = {
    plugins: "PLUGINS",
    skills: "SKILLS",
    mcp: "MCP",
    marketplaces: "MARKETPLACES",
    memories: "MEMORIES",
    status: "SERVICE_STATUS",
  };

  export const CLAUDE_ICONS: Record<ClaudeKind, IconSource> = {
    plugins: Blocks,
    skills: Wand,
    mcp: Unplug,
    marketplaces: Store,
    memories: Brain,
    status: Activity,
  };

  const CLAUDE_EMPTY: Record<Exclude<ClaudeKind, "status">, string> = {
    plugins: "NO_PLUGINS",
    skills: "NO_SKILLS",
    mcp: "NO_MCP_SERVERS",
    marketplaces: "NO_MARKETPLACES",
    memories: "NO_MEMORIES",
  };

  export const STATUS_PAGE = "https://status.claude.com";
</script>

<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import MessageSquareText from "@lucide/svelte/icons/message-square-text";
  import Plus from "@lucide/svelte/icons/plus";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import { openFilePreview } from "$lib/app/filePreview";
  import { navigation } from "$lib/app/navigation.svelte";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import { AUTH_KINDS, emptyAuth, type AuthInput } from "$lib/data/auth";
  import { joined, SEPARATOR } from "$lib/data/format";
  import { holdRefresh } from "$lib/data/inflight";
  import { projectLabel, projectNameOf, sessionIdPreview, sessionLabel } from "$lib/data/models";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { formatDateShort, parseIsoMillis } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch, openExternal } from "$lib/platform";
  import { useRefreshTick } from "$lib/platform/useRefreshTick.svelte";
  import {
    claudeApi,
    pluginKey,
    type ActionResult,
    type CatalogPlugin,
    type ChatMod,
    type Extensions,
    type Marketplace,
    type McpServer,
    type Memories,
    type Plugin,
    type PluginChange,
    type PluginReview,
    type ServiceStatus,
    type Skill,
  } from "$lib/services/claudeApi";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import AuthFields from "$lib/ui/AuthFields.svelte";
  import { LIST_VIEWPORT_CLASS, SCROLL_ROW_CLASS } from "$lib/ui/scrollbar";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState, { NO_RESULTS_ICON } from "$lib/ui/EmptyState.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import SelectChip from "$lib/ui/SelectChip.svelte";
  import ClaudeCard, { TAG_CLASS } from "./ClaudeCard.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import { rem } from "$lib/ui/rem";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { modAreas, modCommands } from "./modAreas";
  import PluginOptionsDialog from "./PluginOptionsDialog.svelte";
  import PluginReloadDialog from "./PluginReloadDialog.svelte";
  import { componentLabel, componentTone, incidentLabel, indicatorLabel, indicatorTone } from "./serviceStatus";

  interface Props {
    kind: ClaudeKind;
    onClose: () => void;
    embedded?: boolean;
    query?: string;
  }

  type CatalogSource = { kind: "all" } | { kind: "market"; name: string } | { kind: "chats" };
  type CatalogEntry = CatalogPlugin & { marketplace: string };
  type PluginFilter = { kind: "all" } | { kind: "mods" } | { kind: "market"; name: string };

  const { kind, onClose, embedded = false, query = "" }: Props = $props();

  const compact = inPane();

  const SKILL_FILE = "SKILL.md";
  const TRANSPORTS = ["stdio", "http", "sse"];
  const CARD_REM = 18;
  const PANEL_REM = 22.5;
  const GAP_REM = 1;

  const chat = $derived(tabs.state);

  let extensions = $state<Extensions | null>(null);
  let skills = $state<Skill[] | null>(null);
  let mcpServers = $state<McpServer[] | null>(null);
  let memories = $state<Memories | null>(null);
  let service = $state<ServiceStatus | null>(null);
  let loaded = $state(false);
  let refreshing = $state(false);
  let busy = $state(false);
  let dialogBusy = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let reloadHeld = $state(false);

  let memoriesProject = $state<string | null>(null);
  let skillQuery = $state("");
  let skillSheet = $state<Skill | null>(null);
  let skillFiles = $state<string[] | null>(null);

  let pluginMenu = $state<Plugin | null>(null);
  let pluginReview = $state<PluginReview | null>(null);
  let optionsFor = $state<Plugin | null>(null);
  let localCandidate = $state<ChatMod | null>(null);
  let pickingFolder = $state(false);
  let confirmUninstall = $state<Plugin | null>(null);
  let marketMenu = $state<Marketplace | null>(null);
  let confirmMarketRemove = $state<Marketplace | null>(null);
  let addingMarket = $state(false);
  let catalogSource = $state.raw<CatalogSource | null>(null);
  let catalog = $state<CatalogEntry[] | null>(null);
  let catalogQuery = $state("");
  let marketPicker = $state(false);
  let updatingMarkets = $state(false);
  let installCandidate = $state<CatalogEntry | null>(null);
  let mcpMenu = $state<McpServer | null>(null);
  let confirmMcpRemove = $state<McpServer | null>(null);
  let addingMcp = $state(false);
  let mcpName = $state("");
  let mcpTarget = $state("");
  let mcpTransport = $state(TRANSPORTS[0]);
  let mcpAuth = $state<AuthInput>(emptyAuth());
  let mcpEnv = $state("");
  let areaWidth = $state(0);
  let viewHeight = $state(0);

  const PANEL_KINDS: ClaudeKind[] = ["plugins", "skills", "mcp", "marketplaces"];

  const sidePanel = $derived(
    embedded && PANEL_KINDS.includes(kind) && areaWidth >= (CARD_REM + GAP_REM + PANEL_REM) * rem(),
  );

  const skillKey = (skill: Skill) => `${skill.plugin}/${skill.id}`;

  const panelTitle = $derived(
    kind === "plugins"
      ? pluginMenu?.name
      : kind === "skills"
        ? skillSheet?.name
        : kind === "mcp"
          ? mcpMenu?.name
          : kind === "marketplaces"
            ? marketMenu?.name
            : undefined,
  );

  const title = $derived(
    kind === "plugins"
      ? t("PLUGINS")
      : kind === "skills"
        ? t("SKILLS")
        : kind === "mcp"
          ? t("MCP_SERVERS")
          : kind === "marketplaces"
            ? t("MARKETPLACES")
            : kind === "memories"
              ? t("MEMORIES")
              : t("SERVICE_STATUS"),
  );

  const load = async () => {
    if (kind === "plugins" || kind === "marketplaces") extensions = await claudeApi.extensions();
    else if (kind === "skills") skills = await claudeApi.skills();
    else if (kind === "mcp") mcpServers = await claudeApi.mcp();
    else if (kind === "memories") memories = await claudeApi.memories(memoriesProject);
    else if (kind === "status") service = await claudeApi.status();
    loaded = true;
  };

  const refresh = async () => {
    if (refreshing) return;
    refreshing = true;
    await holdRefresh(load());
    refreshing = false;
  };

  let actionRun = 0;

  const cancelAction = () => {
    actionRun += 1;
    dialogBusy = null;
    busy = false;
    void load();
  };

  const reload = async () => {
    await load();
    if (catalogSource) catalog = await catalogOf(catalogSource);
    pluginMenu = pluginMenu
      ? (extensions?.plugins.find(
          (item) => item.name === pluginMenu?.name && item.marketplace === pluginMenu?.marketplace,
        ) ?? null)
      : null;
    mcpMenu = mcpMenu ? (mcpServers?.find((item) => item.name === mcpMenu?.name) ?? null) : null;
    marketMenu = marketMenu ? (extensions?.marketplaces.find((item) => item.name === marketMenu?.name) ?? null) : null;
  };

  const runAction = async (action: () => Promise<ActionResult | PluginChange>) => {
    const run = ++actionRun;
    busy = true;
    const result = await action();
    if (run !== actionRun) return;
    if (!result.ok) actionError = result.message || t("CONNECTION_ERROR");
    else if ("held" in result && result.held) reloadHeld = true;
    await reload();
    dialogBusy = null;
    busy = false;
  };

  const updateMarkets = async (names: string[], report: boolean) => {
    if (updatingMarkets || !names.length) return;
    updatingMarkets = true;
    const results = await Promise.all(names.map((name) => claudeApi.marketplaceAction("update", name)));
    const failed = results.find((result) => !result.ok);
    if (report && failed) actionError = failed.message || t("CONNECTION_ERROR");
    await reload();
    updatingMarkets = false;
  };

  const marketNames = (wanted: (market: Marketplace) => boolean) =>
    (extensions?.marketplaces ?? []).filter(wanted).map((market) => market.name);

  const marketCatalog = async (name: string): Promise<CatalogEntry[] | null> =>
    (await claudeApi.catalog(name))?.map((entry) => ({ ...entry, marketplace: name })) ?? null;

  const catalogOf = async (source: CatalogSource): Promise<CatalogEntry[] | null> => {
    if (source.kind === "market") return marketCatalog(source.name);
    if (source.kind === "chats") return [];
    const lists = await Promise.all((extensions?.marketplaces ?? []).map((market) => marketCatalog(market.name)));
    return lists.length && lists.every((list) => list === null) ? null : lists.flatMap((list) => list ?? []);
  };

  const openCatalog = async (source: CatalogSource) => {
    catalogSource = source;
    catalog = null;
    catalogQuery = "";
    const list = await catalogOf(source);
    if (catalogSource === source) catalog = list;
  };

  const browse = () => {
    void openCatalog({ kind: "all" });
    void updateMarkets(marketNames((market) => market.autoUpdate), false);
  };

  const catalogTitle = (source: CatalogSource) =>
    source.kind === "all" ? t("ALL_MARKETPLACES") : source.kind === "chats" ? t("CHAT_MODS") : source.name;

  const reviewKey = $derived(pluginMenu?.mod ? pluginKey(pluginMenu) : null);

  const chatTitle = (mod: ChatMod) => {
    const session = chat.list?.sessions.find((item) => item.sessionId === mod.sessionId);
    return session ? sessionLabel(session) : sessionIdPreview(mod.sessionId);
  };

  const installLocal = (path: string) => {
    localCandidate = null;
    catalogSource = null;
    void runAction(() => claudeApi.addLocalPlugin(path));
  };

  const needle = $derived((embedded ? query : skillQuery).trim().toLowerCase());

  const matches = (...fields: (string | null | undefined)[]) =>
    !needle || fields.some((field) => field?.toLowerCase().includes(needle));

  let pluginFilter = $state.raw<PluginFilter>({ kind: "all" });

  const pluginMatches = (plugin: Plugin, filter: PluginFilter) =>
    filter.kind === "all" ||
    (filter.kind === "mods" ? plugin.mod : !plugin.local && plugin.marketplace === filter.name);

  const pluginFilters = $derived.by((): { filter: PluginFilter; label: string; count: number }[] => {
    const list = extensions?.plugins ?? [];
    const markets = [
      ...new Set(list.flatMap((plugin) => (!plugin.local && plugin.marketplace ? [plugin.marketplace] : []))),
    ];
    const entries: { filter: PluginFilter; label: string; count: number }[] = [
      { filter: { kind: "all" }, label: t("ALL"), count: list.length },
      { filter: { kind: "mods" }, label: t("MODS"), count: list.filter((plugin) => plugin.mod).length },
      ...markets.map((name) => {
        const filter: PluginFilter = { kind: "market", name };
        return { filter, label: name, count: list.filter((plugin) => pluginMatches(plugin, filter)).length };
      }),
    ];
    return entries.filter((item) => item.filter.kind === "all" || item.count > 0);
  });

  const sameFilter = (a: PluginFilter, b: PluginFilter) =>
    a.kind === b.kind && (a.kind !== "market" || (b.kind === "market" && a.name === b.name));

  const filteredPlugins = $derived(
    (extensions?.plugins ?? []).filter(
      (plugin) => pluginMatches(plugin, pluginFilter) && matches(plugin.name, plugin.description, plugin.marketplace),
    ),
  );

  const filteredSkills = $derived(
    (skills ?? []).filter((skill) => matches(skill.name, skill.description, skill.pluginName)),
  );

  const filteredMcp = $derived((mcpServers ?? []).filter((server) => matches(server.name, server.detail)));

  const filteredMarkets = $derived(
    (extensions?.marketplaces ?? []).filter((market) => matches(market.name, market.repo)),
  );
  const catalogMatches = (entry: { name: string; description: string | null }) => {
    const query = catalogQuery.trim().toLowerCase();
    return !query || entry.name.toLowerCase().includes(query) || !!entry.description?.toLowerCase().includes(query);
  };

  const filteredCatalog = $derived((catalog ?? []).filter(catalogMatches));

  const filteredChatMods = $derived((extensions?.chatMods ?? []).filter(catalogMatches));

  const memoryList = $derived(
    [...(memories?.global ?? []), ...(memories?.project ?? [])].filter((memory) =>
      matches(memory.name, memory.description),
    ),
  );

  const filtering = $derived(!!needle || (kind === "plugins" && pluginFilter.kind !== "all"));

  const failed = $derived(
    loaded &&
      (kind === "plugins" || kind === "marketplaces"
        ? extensions === null
        : kind === "skills"
          ? skills === null
          : kind === "mcp"
            ? mcpServers === null
            : kind === "memories"
              ? memories === null
              : service === null),
  );

  const shownCount = $derived(
    kind === "plugins"
      ? filteredPlugins.length
      : kind === "skills"
        ? filteredSkills.length
        : kind === "mcp"
          ? filteredMcp.length
          : kind === "marketplaces"
            ? filteredMarkets.length
            : memoryList.length,
  );

  $effect(() => {
    if (!sidePanel || !loaded) return;
    if (kind === "plugins") {
      const current = pluginMenu;
      if (!current || !filteredPlugins.some((plugin) => pluginKey(plugin) === pluginKey(current)))
        pluginMenu = filteredPlugins[0] ?? null;
    } else if (kind === "skills") {
      const current = skillSheet;
      if (!current || !filteredSkills.some((skill) => skillKey(skill) === skillKey(current)))
        skillSheet = filteredSkills[0] ?? null;
    } else if (kind === "mcp") {
      const current = mcpMenu;
      if (!current || !filteredMcp.some((server) => server.name === current.name)) mcpMenu = filteredMcp[0] ?? null;
    } else if (kind === "marketplaces") {
      const current = marketMenu;
      if (!current || !filteredMarkets.some((market) => market.name === current.name))
        marketMenu = filteredMarkets[0] ?? null;
    }
  });

  let sideShown = false;

  $effect(() => {
    const shown = sidePanel;
    if (sideShown && !shown) {
      pluginMenu = null;
      skillSheet = null;
      mcpMenu = null;
      marketMenu = null;
    }
    sideShown = shown;
  });

  const scopeLabel = (scope: string) => (scope === "global" ? t("MEMORY_GLOBAL") : t("MEMORIES"));

  const openMemory = (scope: string, name: string) => {
    const project = scope === "global" ? null : memoriesProject;
    openFilePreview({
      url: claudeApi.memoryUrl(scope, project, name),
      name,
      onDelete: () => void claudeApi.deleteMemory(scope, project, name).then(load),
    });
  };

  const openSkillFile = (skill: Skill, file: string, name: string) => {
    openFilePreview({ url: claudeApi.skillFileUrl(skill.plugin, skill.id, file), name, onDelete: null });
  };

  $effect(() => {
    void kind;
    if (kind === "memories" && memoriesProject === null)
      memoriesProject = chat.defaultProjectKey(chat.historyProjects) ?? chat.projectKey;
    void load();
  });

  useRefreshTick(() => {
    if (kind === "status") void refresh();
  });

  $effect(() => {
    const skill = skillSheet;
    skillFiles = null;
    if (skill) void claudeApi.skillFiles(skill.plugin, skill.id).then((files) => (skillFiles = files));
  });

  $effect(() => {
    const key = reviewKey;
    pluginReview = null;
    if (!key) return;
    void claudeApi.pluginReview(key).then((review) => {
      if (key !== reviewKey) return;
      pluginReview = review ?? { hooks: [], calls: [], commands: [], errors: [t("CONNECTION_ERROR")] };
    });
  });
</script>

{#snippet stateDot(enabled: boolean)}
  <span class="ml-3 inline-flex">
    <StatusDot class={enabled ? "bg-green" : "bg-faint"} box={16} />
  </span>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
  {#if embedded}
    {#if kind !== "status"}
      <div class="flex shrink-0 items-center gap-1.5 px-(--page-inset) pb-3">
        {#if kind === "plugins" && loaded}
          <div class="{SCROLL_ROW_CLASS} flex min-w-0 items-center gap-1.5">
            {#each pluginFilters as item (item.label)}
              <SelectChip
                label={item.label}
                count={item.count}
                selected={sameFilter(item.filter, pluginFilter)}
                onclick={() => (pluginFilter = item.filter)}
              />
            {/each}
          </div>
        {/if}
        <div class="flex-1"></div>
        <div class="flex shrink-0 items-center">{@render headerActions()}</div>
      </div>
    {/if}
  {:else if compact}
    <PaneHeader {title} onBack={onClose} actions={headerActions} />
  {:else}
    <AppTopBar
      {title}
      subtitle={kind === "memories" && memoriesProject
        ? projectNameOf(chat.historyProjects, memoriesProject, chat.cwd)
        : null}
    >
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={onClose}>
          <ArrowLeft />
        </TooltipIconButton>
      {/snippet}
      {#snippet actions()}
        {@render headerActions()}
      {/snippet}
    </AppTopBar>
  {/if}

  {#snippet headerActions()}
    {#if kind === "plugins"}
      <TooltipIconButton label={t("INSTALL")} onclick={browse}>
        <Plus />
      </TooltipIconButton>
    {:else if kind === "marketplaces"}
      <TooltipIconButton label={t("ADD")} onclick={() => (addingMarket = true)}>
        <Plus />
      </TooltipIconButton>
    {:else if kind === "mcp"}
      <TooltipIconButton
        label={t("ADD")}
        onclick={() => {
          mcpName = "";
          mcpTarget = "";
          mcpTransport = TRANSPORTS[0];
          mcpAuth = emptyAuth();
          mcpEnv = "";
          addingMcp = true;
        }}
      >
        <Plus />
      </TooltipIconButton>
    {:else if kind === "status"}
      <TooltipIconButton label={t("STATUS_OPEN_PAGE")} onclick={() => openExternal(STATUS_PAGE)}>
        <ExternalLink />
      </TooltipIconButton>
    {/if}
    {#if kind === "status" && !isTouch}
      <TooltipIconButton
        label={t("REFRESH")}
        shortcut="window.refresh"
        onclick={() => void refresh()}
      >
        <RotateCw />
      </TooltipIconButton>
    {/if}
  {/snippet}

  {#if kind === "memories" && chat.historyProjects.length}
    <div class="px-(--page-inset) pb-3 {embedded ? 'max-w-md' : ''}">
      <SelectField
        label={t("PROJECT")}
        selected={memoriesProject ?? ""}
        options={chat.historyProjects.map((item) => ({ value: item.projectKey, label: projectLabel(item) }))}
        onSelect={(key) => {
          memoriesProject = key;
          void claudeApi.memories(key).then((value) => (memories = value));
        }}
      />
    </div>
  {/if}

  {#if kind === "skills" && loaded && !embedded}
    <div class="px-(--page-inset) pb-2">
      <SearchBar
        value={skillQuery}
        oninput={(value) => (skillQuery = value)}
        placeholder={t("SEARCH")}
      />
    </div>
  {/if}

  {#if serverStatus.unavailable}
    <ServerUnavailable class="min-h-0 flex-1" />
  {:else if !loaded}
    <CenteredProgress class="flex-1" />
  {:else if failed}
    <ConnectionError class="min-h-0 flex-1" />
  {:else if kind !== "status" && !shownCount}
    <EmptyState
      icon={filtering ? NO_RESULTS_ICON : CLAUDE_ICONS[kind]}
      text={t(filtering ? "NO_RESULTS" : CLAUDE_EMPTY[kind])}
      class="min-h-0 flex-1"
    />
  {:else if embedded && kind !== "status"}
    <div bind:clientHeight={viewHeight} class="flex min-h-0 flex-1 flex-col">
    <PullToRefresh {refreshing} onRefresh={null}>
      <div class="px-(--page-inset) pb-(--page-inset)">
      <div bind:clientWidth={areaWidth} class="flex items-start" style="gap: {GAP_REM}rem">
        <div class="min-w-0 flex-1">
          <div
            class="grid content-start gap-2"
            style="grid-template-columns: repeat(auto-fill, minmax(min({CARD_REM}rem, 100%), 1fr))"
          >
            {#if kind === "plugins"}
              {#each filteredPlugins as plugin (pluginKey(plugin))}
                <ClaudeCard
                  title={plugin.name}
                  tag={plugin.mod ? t("MOD") : null}
                  enabled={plugin.enabled}
                  source={joined(plugin.local ? t("PLUGIN_LOCAL") : plugin.marketplace, plugin.version, plugin.scope)}
                  description={plugin.description}
                  selected={sidePanel && !!pluginMenu && pluginKey(pluginMenu) === pluginKey(plugin)}
                  onclick={() => (pluginMenu = plugin)}
                />
              {/each}
            {:else if kind === "skills"}
              {#each filteredSkills as skill (skillKey(skill))}
                <ClaudeCard
                  title={skill.name}
                  enabled={skill.enabled}
                  source={skill.pluginName}
                  description={skill.description}
                  selected={sidePanel && !!skillSheet && skillKey(skillSheet) === skillKey(skill)}
                  onclick={() => (skillSheet = skill)}
                />
              {/each}
            {:else if kind === "mcp"}
              {#each filteredMcp as server (server.name)}
                <ClaudeCard
                  title={server.name}
                  enabled={server.enabled}
                  source={server.type}
                  description={server.detail}
                  selected={sidePanel && mcpMenu?.name === server.name}
                  onclick={() => (mcpMenu = server)}
                />
              {/each}
            {:else if kind === "marketplaces"}
              {#each filteredMarkets as market (market.name)}
                <ClaudeCard
                  title={market.name}
                  source={market.repo}
                  selected={sidePanel && marketMenu?.name === market.name}
                  onclick={() => (marketMenu = market)}
                />
              {/each}
            {:else}
              {#each memoryList as memory (`${memory.scope}/${memory.name}`)}
                <ClaudeCard
                  title={memory.name}
                  source={scopeLabel(memory.scope)}
                  description={memory.description}
                  onclick={() => openMemory(memory.scope, memory.name)}
                />
              {/each}
            {/if}
          </div>
        </div>
        {#if sidePanel && panelTitle}
          <div
            class="sticky top-0 flex shrink-0"
            style="width: {PANEL_REM}rem; max-height: calc({viewHeight}px - var(--page-inset))"
          >
            <ScrollCard frame="flex-1 rounded-panel" class="scrollbar-thin">
              <div class="flex min-h-full flex-col gap-3.5 px-2.5 py-2">
                <div class="flex items-center gap-2.5">
                  <p class="min-w-0 truncate text-title-lg">{panelTitle}</p>
                  {#if kind === "plugins" && pluginMenu}
                    {#if pluginMenu.mod}
                      <span class={TAG_CLASS}>{t("MOD")}</span>
                    {/if}
                    <span class="ml-auto flex shrink-0">{@render pluginSwitch(pluginMenu)}</span>
                  {:else if kind === "mcp" && mcpMenu}
                    <span class="ml-auto flex shrink-0">{@render mcpSwitch(mcpMenu)}</span>
                  {/if}
                </div>
                <div class="flex flex-1 flex-col gap-3.5 [--c-card:var(--c-hover)]">
                  {#if kind === "plugins" && pluginMenu}
                    {@render pluginBody(pluginMenu)}
                  {:else if kind === "skills" && skillSheet}
                    {@render skillBody(skillSheet)}
                  {:else if kind === "mcp" && mcpMenu}
                    {@render mcpBody(mcpMenu)}
                  {:else if kind === "marketplaces" && marketMenu}
                    {@render marketBody(marketMenu)}
                  {/if}
                </div>
              </div>
            </ScrollCard>
          </div>
        {/if}
      </div>
      </div>
    </PullToRefresh>
    </div>
  {:else}
    <PullToRefresh
      {refreshing}
      onRefresh={kind === "status" ? () => void refresh() : null}
      class={kind === "status" ? "" : LIST_VIEWPORT_CLASS}
    >
    <div class="{kind === 'status' ? 'flex min-h-full flex-col px-(--page-inset)' : ''} pb-(--page-inset)">
      {#if kind === "plugins"}
        {#each filteredPlugins as plugin (pluginKey(plugin))}
          <ListRow
            title={plugin.name}
            subtitle={joined(
              plugin.mod && t("MOD"),
              plugin.local ? t("PLUGIN_LOCAL") : plugin.marketplace,
              plugin.version,
              plugin.scope,
            )}
            onclick={() => (pluginMenu = plugin)}
          >
            {#snippet trailing()}
              {@render stateDot(plugin.enabled)}
            {/snippet}
          </ListRow>
        {/each}
      {:else if kind === "skills"}
        {#each filteredSkills as skill (`${skill.plugin}/${skill.id}`)}
          <ListRow
            title={skill.name}
            subtitle={skill.description ?? skill.pluginName}
            onclick={() => (skillSheet = skill)}
          >
            {#snippet trailing()}
              {@render stateDot(skill.enabled)}
            {/snippet}
          </ListRow>
        {/each}
      {:else if kind === "mcp"}
        {#each filteredMcp as server (server.name)}
          <ListRow
            title={server.name}
            subtitle={joined(server.type, server.detail)}
            onclick={() => (mcpMenu = server)}
          >
            {#snippet trailing()}
              {@render stateDot(server.enabled)}
            {/snippet}
          </ListRow>
        {/each}
      {:else if kind === "marketplaces"}
        {#each filteredMarkets as market (market.name)}
          <ListRow title={market.name} subtitle={market.repo} onclick={() => (marketMenu = market)}>
            {#snippet trailing()}
              {@render stateDot(true)}
            {/snippet}
          </ListRow>
        {/each}
      {:else if kind === "memories"}
        {#each memoryList as memory (`${memory.scope}/${memory.name}`)}
          <ListRow
            title={memory.name}
            subtitle={memory.description ?? scopeLabel(memory.scope)}
            onclick={() => openMemory(memory.scope, memory.name)}
          >
            {#snippet trailing()}
              {@render stateDot(true)}
            {/snippet}
          </ListRow>
        {/each}
      {:else if !service || service.error !== null}
        <EmptyState icon={CLAUDE_ICONS.status} text={t("STATUS_UNKNOWN")} class="flex-1" />
      {:else}
        {@const indicator = service.indicator}
        <div class={embedded ? "grid grid-cols-[repeat(auto-fit,minmax(min(24rem,100%),1fr))] items-start gap-4" : ""}>
          <SettingsGroup label={indicatorLabel(indicator)}>
            {#snippet labelTrailing()}
              <StatusDot class={indicatorTone(indicator)} />
            {/snippet}
            {#each service.components as component (component.name)}
              <div class="flex min-h-10 items-center gap-3 px-3 py-2">
                <p class="min-w-0 flex-1 truncate text-body-md">{component.name}</p>
                <p class="text-body-sm text-on-surface-variant">{componentLabel(component.status)}</p>
                <StatusDot class={componentTone(component.status)} box={16} />
              </div>
            {/each}
          </SettingsGroup>
          <SettingsGroup label={t("STATUS_INCIDENTS")}>
            {#if !service.incidents.length}
              <p class="px-3 py-2.5 text-body-sm text-on-surface-variant">{t("STATUS_NO_INCIDENTS")}</p>
            {:else}
              {#each service.incidents as incident (incident.name)}
                {@const millis = incident.updatedAt === null ? null : parseIsoMillis(incident.updatedAt)}
                <Pressable
                  enabled={!!incident.shortlink}
                  onclick={() => incident.shortlink && openExternal(incident.shortlink)}
                  class="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left"
                >
                  <span class="flex h-5 shrink-0 items-center">
                    <StatusDot class={indicatorTone(incident.impact)} box={16} />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-body-md">{incident.name}</p>
                    {#if incident.latest}
                      <p class="mt-0.5 line-clamp-4 text-body-sm text-on-surface-variant">
                        {#if incident.status}
                          <span class="text-label-md {indicatorTone(incident.impact).replace('bg-', 'text-')}">
                            {incidentLabel(incident.status)}
                          </span>
                          {SEPARATOR}
                        {/if}
                        {incident.latest}
                      </p>
                    {/if}
                    {#if millis !== null}
                      <p class="mt-0.5 text-label-md text-on-surface-variant">{formatDateShort(millis)}</p>
                    {/if}
                  </div>
                </Pressable>
              {/each}
            {/if}
          </SettingsGroup>
        </div>
      {/if}
    </div>
    </PullToRefresh>
  {/if}
</div>

{#snippet skillBody(skill: Skill)}
  {#if !skillFiles}
    <CenteredProgress class="py-6" />
  {:else}
    {@const references = skillFiles.filter((file) => file !== SKILL_FILE)}
    <div>
      {#if skill.description}
        <CardPanel class="mb-2.5">
          <p class="text-body-sm text-on-surface-variant">{skill.description}</p>
        </CardPanel>
      {/if}
      <CardPanel onclick={() => openSkillFile(skill, SKILL_FILE, `${skill.id} - ${SKILL_FILE}`)}>
        <p class="text-body-md">{SKILL_FILE}</p>
      </CardPanel>
      {#if references.length}
        <p class="mt-3 mb-1.5 text-label-lg text-accent">{t("REFERENCES")}</p>
        <div class="flex flex-col gap-1.5">
          {#each references as file (file)}
            <CardPanel onclick={() => openSkillFile(skill, file, file.split("/").pop() ?? file)}>
              <p class="text-body-md">{file.split("/").pop()}</p>
              <p class="text-body-sm text-on-surface-variant">{file}</p>
            </CardPanel>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

{#if skillSheet && !sidePanel && !navigation.preview}
  {@const skill = skillSheet}
  <CompactDialog title={skill.name} onDismiss={() => (skillSheet = null)}>
    {#snippet buttons()}
      <Button onclick={() => (skillSheet = null)} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    {@render skillBody(skill)}
  </CompactDialog>
{/if}

{#snippet pluginSwitch(plugin: Plugin)}
  <CompactSwitch
    checked={plugin.enabled}
    enabled={!busy}
    onCheckedChange={() => {
      dialogBusy = "toggle";
      void runAction(() => claudeApi.pluginAction(plugin.enabled ? "disable" : "enable", pluginKey(plugin)));
    }}
  />
{/snippet}

{#snippet facts(rows: { label: string; text: string | null }[])}
  {#if rows.length}
    <dl class="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-2.5 gap-y-2 text-body-sm">
      {#each rows as fact (fact.label)}
        <dt class="text-faint">{fact.label}</dt>
        <dd class="wrap-anywhere">{fact.text}</dd>
      {/each}
    </dl>
  {/if}
{/snippet}

{#snippet pluginBody(plugin: Plugin)}
  {#if plugin.mod && !pluginReview}
    <CenteredProgress class="py-6" />
  {:else}
    {@const rows = [
      { label: t("MARKETPLACE"), text: plugin.local ? t("PLUGIN_LOCAL") : plugin.marketplace },
      { label: t("VERSION"), text: plugin.version ?? "" },
      { label: t("COMMANDS"), text: pluginReview && plugin.mod ? modCommands(pluginReview).join(SEPARATOR) : "" },
      { label: t("MOD_CALLS"), text: pluginReview && plugin.mod ? joined(...modAreas(pluginReview)) : "" },
    ].filter((fact) => fact.text)}
    {#if plugin.description}
      <p class="text-body-md text-on-surface-variant">{plugin.description}</p>
    {/if}
    {@render facts(rows)}
    {#if plugin.mod && pluginReview}
      {#each pluginReview.errors as error (error)}
        <ErrorText text={error} />
      {/each}
      {#if !rows.some((fact) => fact.label === t("COMMANDS") || fact.label === t("MOD_CALLS")) && !pluginReview.errors.length}
        <p class="text-body-sm text-on-surface-variant">{t("MOD_REVIEW_EMPTY")}</p>
      {/if}
    {/if}
    {#if dialogBusy}
      <LinearProgress />
    {/if}
    <div class="mt-auto flex flex-col gap-2.5">
      {#if plugin.options}
        <ActionButton text={t("PLUGIN_OPTIONS")} enabled={!busy} onclick={() => (optionsFor = plugin)} class="w-full" />
      {/if}
      {#if !plugin.local}
        <ActionButton
          text={t("UPDATE_ACTION")}
          enabled={!busy}
          onclick={() => {
            dialogBusy = "update";
            void runAction(() => claudeApi.pluginAction("update", pluginKey(plugin)));
          }}
          class="w-full"
        />
      {/if}
      <ActionButton
        text={t("UNINSTALL")}
        enabled={!busy}
        danger
        onclick={() => (confirmUninstall = plugin)}
        class="w-full"
      />
    </div>
  {/if}
{/snippet}

{#if pluginMenu && !sidePanel}
  {@const plugin = pluginMenu}
  <CompactDialog title={plugin.name} onDismiss={() => { cancelAction(); pluginMenu = null; }}>
    {#snippet titleTrailing()}
      {@render pluginSwitch(plugin)}
    {/snippet}
    {#snippet buttons()}
      <Button onclick={() => { cancelAction(); pluginMenu = null; }} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    <div class="flex flex-col gap-3.5">
      {@render pluginBody(plugin)}
    </div>
  </CompactDialog>
{/if}

{#if confirmUninstall}
  {@const plugin = confirmUninstall}
  <ConfirmDialog
    title={t("UNINSTALL")}
    text={t("DELETE_FILE_CONFIRM", plugin.name)}
    confirmLabel={t("UNINSTALL")}
    danger
    onConfirm={() => {
      const key = pluginKey(plugin);
      confirmUninstall = null;
      dialogBusy = "uninstall";
      void runAction(() => claudeApi.pluginAction("uninstall", key));
    }}
    onDismiss={() => (confirmUninstall = null)}
  />
{/if}

{#if catalogSource}
  {@const source = catalogSource}
  <CompactDialog title={catalogTitle(source)} onDismiss={() => (catalogSource = null)}>
    {#snippet titleTrailing()}
      {#if source.kind !== "chats"}
        <TooltipIconButton
          label={t("UPDATE_ACTION")}
          enabled={!updatingMarkets}
          onclick={() =>
            void updateMarkets(source.kind === "market" ? [source.name] : marketNames(() => true), true)}
        >
          <RotateCw />
        </TooltipIconButton>
      {/if}
      <PopupMenu open={marketPicker} label={t("MARKETPLACES")} onOpenChange={(open) => (marketPicker = open)}>
        {#snippet triggerChild(props)}
          <TooltipIconButton label={t("MARKETPLACES")} {...props}>
            <Store />
          </TooltipIconButton>
        {/snippet}
        <MenuItem
          text={t("ALL_MARKETPLACES")}
          selected={source.kind === "all"}
          onclick={() => {
            marketPicker = false;
            void openCatalog({ kind: "all" });
          }}
        />
        {#each extensions?.marketplaces ?? [] as entry (entry.name)}
          <MenuItem
            text={entry.name}
            selected={source.kind === "market" && entry.name === source.name}
            onclick={() => {
              marketPicker = false;
              void openCatalog({ kind: "market", name: entry.name });
            }}
          />
        {/each}
        <MenuItem
          icon={MessageSquareText}
          text={t("CHAT_MODS")}
          selected={source.kind === "chats"}
          onclick={() => {
            marketPicker = false;
            void openCatalog({ kind: "chats" });
          }}
        />
        <MenuItem
          icon={FolderOpen}
          text={t("PLUGIN_FROM_FOLDER")}
          onclick={() => {
            marketPicker = false;
            pickingFolder = true;
          }}
        />
      </PopupMenu>
    {/snippet}
    {#snippet buttons()}
      <Button onclick={() => (catalogSource = null)} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    {#snippet header()}
      <SearchBar
        value={catalogQuery}
        oninput={(value) => (catalogQuery = value)}
        placeholder={t("SEARCH")}
      />
      {#if busy || updatingMarkets}
        <LinearProgress class="mt-2" />
      {/if}
    {/snippet}
    {#if source.kind === "chats"}
      {#each filteredChatMods as mod (mod.path)}
        <ListRow
          subtitleLines={2}
          title={mod.name + (mod.version ? ` - ${mod.version}` : "")}
          subtitle={joined(chatTitle(mod), mod.description)}
          onclick={() => (localCandidate = mod)}
        >
          {#snippet trailing()}
            {@render stateDot(mod.installed)}
          {/snippet}
        </ListRow>
      {:else}
        <EmptyState text={t(extensions?.chatMods.length ? "NO_RESULTS" : "CHAT_MODS_EMPTY")} class="py-8" />
      {/each}
    {:else if !catalog}
      <CenteredProgress class="py-6" />
    {:else}
      {#each filteredCatalog as entry (`${entry.marketplace}/${entry.name}`)}
        <ListRow
          subtitleLines={2}
          title={entry.name + (entry.version ? ` - ${entry.version}` : "")}
          subtitle={source.kind === "all" ? joined(entry.marketplace, entry.description) : entry.description}
          onclick={() => {
            if (entry.installed) {
              pluginMenu =
                extensions?.plugins.find(
                  (item) => item.name === entry.name && item.marketplace === entry.marketplace,
                ) ?? null;
            } else {
              installCandidate = entry;
            }
          }}
        >
          {#snippet trailing()}
            {@render stateDot(entry.installed)}
          {/snippet}
        </ListRow>
      {:else}
        <EmptyState text={t("NO_RESULTS")} class="py-8" />
      {/each}
    {/if}
  </CompactDialog>
{/if}

{#if installCandidate}
  {@const entry = installCandidate}
  <CompactDialog title={entry.name} onDismiss={() => (installCandidate = null)}>
    {#snippet buttons()}
      <Button onclick={() => (installCandidate = null)} variant="outlined">{t("CANCEL")}</Button>
      <Button
        onclick={() => {
          const key = `${entry.name}@${entry.marketplace}`;
          installCandidate = null;
          void runAction(() => claudeApi.pluginAction("install", key));
        }}
       
      >
        {t("INSTALL")}
      </Button>
    {/snippet}
    <CardPanel>
      <p class="text-body-sm text-on-surface-variant">{entry.description ?? entry.name}</p>
      {#if entry.version}
        <p class="text-label-md text-accent">{t("VERSION_LABEL", entry.version)}</p>
      {/if}
    </CardPanel>
  </CompactDialog>
{/if}

{#if localCandidate}
  {@const mod = localCandidate}
  <CompactDialog title={mod.name} onDismiss={() => (localCandidate = null)}>
    {#snippet buttons()}
      <Button onclick={() => (localCandidate = null)} variant="outlined">{t("CANCEL")}</Button>
      <Button enabled={!mod.installed} onclick={() => installLocal(mod.path)}>{t("INSTALL")}</Button>
    {/snippet}
    <CardPanel>
      {#if mod.description}
        <p class="text-body-sm text-on-surface-variant">{mod.description}</p>
      {/if}
      <p class="text-body-sm wrap-anywhere text-on-surface-variant">{mod.path}</p>
      <p class="text-label-md text-accent">{mod.installed ? t("CHAT_MOD_INSTALLED") : t("CHAT_MOD_INSTALL_HINT")}</p>
    </CardPanel>
  </CompactDialog>
{/if}

{#if pickingFolder}
  <PathPickerDialog
    onConfirm={(path) => {
      pickingFolder = false;
      installLocal(path);
    }}
    onDismiss={() => (pickingFolder = false)}
  />
{/if}

{#if optionsFor}
  {@const plugin = optionsFor}
  <PluginOptionsDialog
    api={claudeApi}
    plugin={pluginKey(plugin)}
    title={plugin.name}
    onDismiss={() => (optionsFor = null)}
  />
{/if}

{#snippet marketBody(market: Marketplace)}
  {#if market.repo}
    <p class="text-body-sm wrap-anywhere text-on-surface-variant">{market.repo}</p>
  {/if}
  <SwitchRow
    title={t("MARKETPLACE_AUTO_UPDATE")}
    summary={t("MARKETPLACE_AUTO_UPDATE_SUMMARY")}
    checked={market.autoUpdate}
    enabled={!busy}
    onChange={(checked) => void runAction(() => claudeApi.marketplaceAutoUpdate(market.name, checked))}
  />
  {#if dialogBusy === "update"}
    <LinearProgress />
  {/if}
  <div class="mt-auto flex flex-col gap-2.5">
    <ActionButton
      text={t("UPDATE_ACTION")}
      enabled={!busy}
      onclick={() => {
        dialogBusy = "update";
        void runAction(() => claudeApi.marketplaceAction("update", market.name));
      }}
      class="w-full"
    />
    <ActionButton
      text={t("DELETE")}
      enabled={!busy}
      danger
      onclick={() => (confirmMarketRemove = market)}
      class="w-full"
    />
  </div>
{/snippet}

{#if marketMenu && !sidePanel}
  {@const market = marketMenu}
  <CompactDialog title={market.name} onDismiss={() => { cancelAction(); marketMenu = null; }}>
    {#snippet buttons()}
      <Button onclick={() => { cancelAction(); marketMenu = null; }} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    <div class="flex flex-col gap-3.5">
      {@render marketBody(market)}
    </div>
  </CompactDialog>
{/if}

{#if confirmMarketRemove}
  {@const market = confirmMarketRemove}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_FILE_CONFIRM", market.name)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => {
      const name = market.name;
      confirmMarketRemove = null;
      marketMenu = null;
      void runAction(() => claudeApi.marketplaceAction("remove", name));
    }}
    onDismiss={() => (confirmMarketRemove = null)}
  />
{/if}

{#if addingMarket}
  <RenameDialog
    initial=""
    title={t("MARKETPLACES")}
    confirmLabel={t("ADD")}
    onConfirm={(target) => {
      addingMarket = false;
      void runAction(() => claudeApi.marketplaceAction("add", target));
    }}
    onDismiss={() => (addingMarket = false)}
  />
{/if}

{#snippet mcpSwitch(server: McpServer)}
  <CompactSwitch
    checked={server.enabled}
    enabled={!busy}
    onCheckedChange={() => {
      dialogBusy = "toggle";
      void runAction(() => claudeApi.mcpToggle(server.name, !server.enabled));
    }}
  />
{/snippet}

{#snippet mcpBody(server: McpServer)}
  {@render facts(
    [
      { label: t("TRANSPORT"), text: server.type ?? "" },
      { label: t("COMMAND_OR_URL"), text: server.detail ?? "" },
    ].filter((fact) => fact.text),
  )}
  {#if dialogBusy === "toggle"}
    <LinearProgress />
  {/if}
  <div class="mt-auto flex flex-col gap-2.5">
    <ActionButton
      text={t("DELETE")}
      enabled={!busy}
      danger
      onclick={() => (confirmMcpRemove = server)}
      class="w-full"
    />
  </div>
{/snippet}

{#if mcpMenu && !sidePanel}
  {@const server = mcpMenu}
  <CompactDialog title={server.name} onDismiss={() => { cancelAction(); mcpMenu = null; }}>
    {#snippet titleTrailing()}
      {@render mcpSwitch(server)}
    {/snippet}
    {#snippet buttons()}
      <Button onclick={() => { cancelAction(); mcpMenu = null; }} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    <div class="flex flex-col gap-3.5">
      {@render mcpBody(server)}
    </div>
  </CompactDialog>
{/if}

{#if confirmMcpRemove}
  {@const server = confirmMcpRemove}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_FILE_CONFIRM", server.name)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => {
      const name = server.name;
      confirmMcpRemove = null;
      mcpMenu = null;
      void runAction(() => claudeApi.mcpRemove(name));
    }}
    onDismiss={() => (confirmMcpRemove = null)}
  />
{/if}

{#if addingMcp}
  <CompactDialog title={t("MCP_SERVERS")} onDismiss={() => (addingMcp = false)}>
    {#snippet buttons()}
      <Button onclick={() => (addingMcp = false)} variant="outlined">{t("CANCEL")}</Button>
      <Button
        onclick={() => {
          addingMcp = false;
          void runAction(() =>
            claudeApi.mcpAdd(mcpName.trim(), mcpTarget.trim(), mcpTransport, mcpAuth, mcpEnv.split("\n")),
          );
        }}
        enabled={!!mcpName.trim() && !!mcpTarget.trim()}
      >
        {t("ADD")}
      </Button>
    {/snippet}
    <div class="flex flex-col gap-2.5">
      <InputField value={mcpName} oninput={(value) => (mcpName = value)} label={t("NAME")} singleLine />
      <SelectField
        label={t("TRANSPORT")}
        selected={mcpTransport}
        options={TRANSPORTS.map((value) => ({ value, label: value }))}
        onSelect={(value) => (mcpTransport = value)}
      />
      <InputField value={mcpTarget} oninput={(value) => (mcpTarget = value)} label={t("COMMAND_OR_URL")} singleLine />
      {#if mcpTransport === "stdio"}
        <InputField
          value={mcpEnv}
          oninput={(value) => (mcpEnv = value)}
          label={t("MCP_ENV")}
          placeholder={t("MCP_ENV_PLACEHOLDER")}
          minLines={2}
        />
      {:else}
        <AuthFields value={mcpAuth} kinds={AUTH_KINDS} onChange={(next) => (mcpAuth = next)} />
      {/if}
    </div>
  </CompactDialog>
{/if}

{#if reloadHeld}
  <PluginReloadDialog api={claudeApi} onDismiss={() => (reloadHeld = false)} />
{/if}

{#if actionError}
  {@const message = actionError}
  <CompactDialog title={t("CONNECTION_ERROR")} onDismiss={() => (actionError = null)}>
    {#snippet buttons()}
      <Button onclick={() => (actionError = null)}>{t("ACCEPT")}</Button>
    {/snippet}
    <p class="text-body-sm text-on-surface-variant">{message}</p>
  </CompactDialog>
{/if}
