<script lang="ts" module>
  export const CLAUDE_KINDS = [
    "plugins",
    "skills",
    "mcp",
    "marketplaces",
    "memories",
    "status",
    "changelog",
  ] as const;

  export type ClaudeKind = (typeof CLAUDE_KINDS)[number];
</script>

<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import CirclePlus from "@lucide/svelte/icons/circle-plus";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Store from "@lucide/svelte/icons/store";
  import X from "@lucide/svelte/icons/x";
  import { navigation } from "$lib/app/navigation.svelte";
  import { projectLabel } from "$lib/data/models";
  import { formatDayTime, parseIsoMillis } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { openExternal } from "$lib/platform";
  import {
    claudeApi,
    type CatalogPlugin,
    type Extensions,
    type Marketplace,
    type McpServer,
    type Memories,
    type Plugin,
    type ServiceStatus,
    type Skill,
  } from "$lib/services/claudeApi";
  import { claudeChangelog, type ReleaseNotes } from "$lib/services/githubApi";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { componentLabel, componentTone, incidentLabel, indicatorLabel, indicatorTone } from "./serviceStatus";

  interface Props {
    kind: ClaudeKind;
    onClose: () => void;
  }

  const { kind, onClose }: Props = $props();

  const STATUS_PAGE = "https://status.claude.com";
  const ROW_PADDING = "py-2 pr-4 pl-4";
  const SKILL_FILE = "SKILL.md";
  const TRANSPORTS = ["stdio", "http", "sse"];

  const chat = $derived(tabs.state);

  let extensions = $state<Extensions | null>(null);
  let skills = $state<Skill[] | null>(null);
  let mcpServers = $state<McpServer[] | null>(null);
  let memories = $state<Memories | null>(null);
  let service = $state<ServiceStatus | null>(null);
  let notes = $state<ReleaseNotes[] | null>(null);
  let notesFailed = $state(false);
  let loaded = $state(false);
  let busy = $state(false);
  let actionError = $state<string | null>(null);

  let memoriesProject = $state<string | null>(null);
  let skillQuery = $state("");
  let skillSheet = $state<Skill | null>(null);
  let skillFiles = $state<string[] | null>(null);

  let pluginMenu = $state<Plugin | null>(null);
  let confirmUninstall = $state<Plugin | null>(null);
  let marketMenu = $state<Marketplace | null>(null);
  let confirmMarketRemove = $state<Marketplace | null>(null);
  let addingMarket = $state(false);
  let catalogMarket = $state<string | null>(null);
  let catalog = $state<CatalogPlugin[] | null>(null);
  let catalogQuery = $state("");
  let marketPicker = $state(false);
  let installCandidate = $state<CatalogPlugin | null>(null);
  let mcpMenu = $state<McpServer | null>(null);
  let confirmMcpRemove = $state<McpServer | null>(null);
  let addingMcp = $state(false);
  let mcpName = $state("");
  let mcpTarget = $state("");
  let mcpTransport = $state(TRANSPORTS[0]);

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
              : kind === "changelog"
                ? t("CHANGELOG")
                : t("SERVICE_STATUS"),
  );

  const load = async () => {
    if (kind === "plugins" || kind === "marketplaces") extensions = await claudeApi.extensions();
    else if (kind === "skills") skills = await claudeApi.skills();
    else if (kind === "mcp") mcpServers = await claudeApi.mcp();
    else if (kind === "memories") memories = await claudeApi.memories(memoriesProject);
    else if (kind === "status") service = await claudeApi.status();
    else if (kind === "changelog") {
      const result = await claudeChangelog(null);
      if (result) notes = result;
      else notesFailed = true;
    }
    loaded = true;
  };

  let actionRun = 0;

  const cancelAction = () => {
    actionRun += 1;
    busy = false;
    void load();
  };

  const runAction = async (action: () => Promise<{ ok: boolean; message: string }>) => {
    const run = ++actionRun;
    busy = true;
    const result = await action();
    if (run !== actionRun) return;
    if (!result.ok) actionError = result.message || t("CONNECTION_ERROR");
    await load();
    if (catalogMarket) catalog = await claudeApi.catalog(catalogMarket);
    pluginMenu = pluginMenu
      ? (extensions?.plugins.find(
          (item) => item.name === pluginMenu?.name && item.marketplace === pluginMenu?.marketplace,
        ) ?? null)
      : null;
    mcpMenu = mcpMenu ? (mcpServers?.find((item) => item.name === mcpMenu?.name) ?? null) : null;
    busy = false;
  };

  const openCatalog = async (market: string) => {
    catalogMarket = market;
    catalog = null;
    catalogQuery = "";
    catalog = await claudeApi.catalog(market);
  };

  const pluginKey = (plugin: Plugin) => `${plugin.name}@${plugin.marketplace}`;

  const filteredSkills = $derived.by(() => {
    const query = skillQuery.trim().toLowerCase();
    const list = skills ?? [];
    if (!query) return list;
    return list.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query) ||
        skill.pluginName?.toLowerCase().includes(query),
    );
  });

  const filteredCatalog = $derived.by(() => {
    const query = catalogQuery.trim().toLowerCase();
    const list = catalog ?? [];
    if (!query) return list;
    return list.filter(
      (entry) => entry.name.toLowerCase().includes(query) || entry.description?.toLowerCase().includes(query),
    );
  });

  const memoryList = $derived([...(memories?.global ?? []), ...(memories?.project ?? [])]);

  const scopeLabel = (scope: string) =>
    scope === "global" ? t("MEMORY_GLOBAL") : scope === "repo" ? "CLAUDE.md" : t("MEMORIES");

  const openMemory = (scope: string, name: string) => {
    const project = scope === "global" ? null : memoriesProject;
    navigation.openPreview({
      url: claudeApi.memoryUrl(scope, project, name),
      name,
      onDelete: () => void claudeApi.deleteMemory(scope, project, name).then(load),
    });
  };

  const openSkillFile = (skill: Skill, file: string, name: string) => {
    navigation.openPreview({ url: claudeApi.skillFileUrl(skill.plugin, skill.id, file), name, onDelete: null });
  };

  $effect(() => {
    void kind;
    if (kind === "memories" && memoriesProject === null)
      memoriesProject = chat.defaultProjectKey(chat.historyProjects) ?? chat.projectKey;
    void load();
  });

  $effect(() => {
    const skill = skillSheet;
    skillFiles = null;
    if (skill) void claudeApi.skillFiles(skill.plugin, skill.id).then((files) => (skillFiles = files));
  });
</script>

{#snippet stateDot(enabled: boolean)}
  <span class="ml-3 inline-flex">
    <StatusDot class={enabled ? "bg-green" : "bg-outline-variant"} box={16} dot={10} />
  </span>
{/snippet}

<div class="flex h-full flex-col">
  <AppTopBar
    {title}
    subtitle={kind === "memories"
      ? (chat.historyProjects.find((item) => item.projectKey === memoriesProject)?.path ?? memoriesProject)
      : null}
  >
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={onClose}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
    {#snippet actions()}
      {#if kind === "plugins"}
        <TooltipIconButton
          label={t("INSTALL")}
          onclick={() => {
            const market = extensions?.marketplaces[0];
            if (market) void openCatalog(market.name);
          }}
        >
          <CirclePlus size={20} />
        </TooltipIconButton>
      {:else if kind === "marketplaces"}
        <TooltipIconButton label={t("ADD")} onclick={() => (addingMarket = true)}>
          <CirclePlus size={20} />
        </TooltipIconButton>
      {:else if kind === "mcp"}
        <TooltipIconButton
          label={t("ADD")}
          onclick={() => {
            mcpName = "";
            mcpTarget = "";
            mcpTransport = TRANSPORTS[0];
            addingMcp = true;
          }}
        >
          <CirclePlus size={20} />
        </TooltipIconButton>
      {:else if kind === "status"}
        <TooltipIconButton
          label={t("STATUS_OPEN_PAGE")}
          onclick={() => openExternal(STATUS_PAGE)}
        >
          <ExternalLink size={20} />
        </TooltipIconButton>
      {/if}
    {/snippet}
  </AppTopBar>

  {#if kind === "memories" && chat.historyProjects.length}
    <div class="px-4 py-1.5">
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

  {#if kind === "skills" && loaded}
    <div class="px-4 py-1.5">
      <InputField value={skillQuery} oninput={(value) => (skillQuery = value)} label={t("SEARCH")} singleLine>
        {#snippet trailing()}
          {#if skillQuery}
            <button
              type="button"
              onclick={() => (skillQuery = "")}
              aria-label={t("CLEAR")}
              class="cursor-pointer text-on-surface-variant"
            >
              <X size={18} />
            </button>
          {/if}
        {/snippet}
      </InputField>
    </div>
  {/if}

  {#if actionError}
    <p class="px-4 py-2 text-body-sm text-error">{actionError}</p>
  {/if}

  {#if !loaded}
    <CenteredProgress class="flex-1" />
  {:else}
    <div class="min-h-0 flex-1 overflow-y-auto pb-4">
      {#if kind === "plugins"}
        {#each extensions?.plugins ?? [] as plugin (pluginKey(plugin))}
          <ListRow
            padding={ROW_PADDING}
            title={plugin.name}
            subtitle={[plugin.marketplace, plugin.version, plugin.scope].filter(Boolean).join(" • ")}
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
            padding={ROW_PADDING}
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
        {#each mcpServers ?? [] as server (server.name)}
          <ListRow
            padding={ROW_PADDING}
            title={server.name}
            subtitle={[server.enabled ? null : t("DISABLED_STATE"), server.type, server.detail]
              .filter(Boolean)
              .join(" • ")}
            onclick={() => (mcpMenu = server)}
          >
            {#snippet trailing()}
              {@render stateDot(true)}
            {/snippet}
          </ListRow>
        {/each}
      {:else if kind === "marketplaces"}
        {#each extensions?.marketplaces ?? [] as market (market.name)}
          <ListRow
            padding={ROW_PADDING}
            title={market.name}
            subtitle={market.repo}
            onclick={() => (marketMenu = market)}
          >
            {#snippet trailing()}
              {@render stateDot(true)}
            {/snippet}
          </ListRow>
        {/each}
      {:else if kind === "memories"}
        {#if !memoryList.length}
          <EmptyState text={t("NO_FILES")} class="h-full" />
        {/if}
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
      {:else if kind === "changelog"}
        {#if notesFailed}
          <EmptyState text={t("CONNECTION_ERROR")} class="h-full" />
        {:else if !notes}
          <CenteredProgress class="h-full" />
        {:else}
          <div class="selectable flex flex-col gap-4 px-4">
            {#each notes as release (release.tag)}
              <div>
                <p class="text-title-md text-accent">{release.tag}</p>
                <MarkdownText text={release.body} class="mt-1" />
              </div>
            {/each}
          </div>
        {/if}
      {:else if !service || service.error !== null}
        <EmptyState text={t("STATUS_UNKNOWN")} class="h-full" />
      {:else}
        <div class="flex items-center gap-3 px-4 py-3">
          <StatusDot class={indicatorTone(service.indicator)} box={18} dot={12} />
          <p class="text-title-md">{indicatorLabel(service.indicator)}</p>
        </div>
        {#each service.components as component (component.name)}
          <div class="flex items-center gap-3 px-4 py-2">
            <p class="min-w-0 flex-1 truncate text-body-lg">{component.name}</p>
            <p class="text-body-sm text-on-surface-variant">{componentLabel(component.status)}</p>
            <StatusDot class={componentTone(component.status)} box={16} dot={10} />
          </div>
        {/each}
        <p class="px-4 pt-4 pb-1 text-label-lg text-accent">{t("STATUS_INCIDENTS")}</p>
        {#if !service.incidents.length}
          <p class="px-4 py-1 text-body-sm text-on-surface-variant">{t("STATUS_NO_INCIDENTS")}</p>
        {:else}
          {#each service.incidents as incident (incident.name)}
            {@const millis = incident.updatedAt === null ? null : parseIsoMillis(incident.updatedAt)}
            <button
              type="button"
              disabled={!incident.shortlink}
              onclick={() => incident.shortlink && openExternal(incident.shortlink)}
              class="block w-full px-4 py-2 text-left {incident.shortlink ? 'cursor-pointer' : 'cursor-default'}"
            >
              <div class="flex items-center gap-2">
                <StatusDot class={indicatorTone(incident.impact)} box={14} dot={9} />
                <span class="min-w-0 flex-1 truncate text-body-lg">{incident.name}</span>
              </div>
              {#if incident.latest}
                <p class="mt-1 line-clamp-4 text-body-sm text-on-surface-variant">
                  {#if incident.status}
                    <span class="font-bold {indicatorTone(incident.impact).replace('bg-', 'text-')}">
                      {incidentLabel(incident.status)}
                    </span>
                    •
                  {/if}
                  {incident.latest}
                </p>
              {/if}
              {#if millis !== null}
                <p class="mt-0.5 text-label-md text-on-surface-variant">{formatDayTime(millis)}</p>
              {/if}
            </button>
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
</div>

{#if skillSheet && !navigation.preview}
  {@const skill = skillSheet}
  <CompactDialog title={skill.name} onDismiss={() => (skillSheet = null)}>
    {#snippet buttons()}
      <Button onclick={() => (skillSheet = null)} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    {#if !skillFiles}
      <CenteredProgress class="py-6" />
    {:else}
      {#if skill.description}
        <OutlinedPanel class="mb-2.5">
          <p class="text-body-sm text-on-surface-variant">{skill.description}</p>
        </OutlinedPanel>
      {/if}
      <OutlinedPanel onclick={() => openSkillFile(skill, SKILL_FILE, `${skill.id} - ${SKILL_FILE}`)}>
        <p class="text-body-lg">{SKILL_FILE}</p>
      </OutlinedPanel>
      {@const references = skillFiles.filter((file) => file !== SKILL_FILE)}
      {#if references.length}
        <p class="mt-3 mb-1.5 text-label-lg text-accent">{t("REFERENCES")}</p>
        <div class="flex flex-col gap-1.5">
          {#each references as file (file)}
            <OutlinedPanel onclick={() => openSkillFile(skill, file, file.split("/").pop() ?? file)}>
              <p class="text-body-md">{file.split("/").pop()}</p>
              <p class="text-body-sm text-on-surface-variant">{file}</p>
            </OutlinedPanel>
          {/each}
        </div>
      {/if}
    {/if}
  </CompactDialog>
{/if}

{#if pluginMenu}
  {@const plugin = pluginMenu}
  <CompactDialog title={plugin.name} onDismiss={() => { cancelAction(); pluginMenu = null; }}>
    {#snippet titleTrailing()}
      <CompactSwitch
        checked={plugin.enabled}
        enabled={!busy}
        onCheckedChange={() =>
          void runAction(() => claudeApi.pluginAction(plugin.enabled ? "disable" : "enable", pluginKey(plugin)))}
      />
    {/snippet}
    {#snippet buttons()}
      <Button onclick={() => { cancelAction(); pluginMenu = null; }} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    {#if plugin.description || plugin.version}
      <OutlinedPanel class="mb-3">
        {#if plugin.description}
          <p class="text-body-sm text-on-surface-variant">{plugin.description}</p>
        {/if}
        {#if plugin.version}
          <p class="text-label-md text-accent">{t("VERSION_LABEL", plugin.version)}</p>
        {/if}
      </OutlinedPanel>
    {/if}
    <div class="flex flex-col gap-2.5">
      <ActionButton
        text={t("UPDATE_ACTION")}
        enabled={!busy}
        onclick={() => void runAction(() => claudeApi.pluginAction("update", pluginKey(plugin)))}
        class="w-full"
      />
      <ActionButton
        text={t("UNINSTALL")}
        enabled={!busy}
        onclick={() => (confirmUninstall = plugin)}
        class="w-full"
      />
    </div>
  </CompactDialog>
{/if}

{#if confirmUninstall}
  {@const plugin = confirmUninstall}
  <ConfirmDialog
    title={t("UNINSTALL")}
    text={t("DELETE_FILE_CONFIRM", plugin.name)}
    confirmLabel={t("UNINSTALL")}
    onConfirm={() => {
      confirmUninstall = null;
      void runAction(() => claudeApi.pluginAction("uninstall", pluginKey(plugin)));
    }}
    onDismiss={() => (confirmUninstall = null)}
  />
{/if}

{#if catalogMarket}
  {@const market = catalogMarket}
  <CompactDialog title={market} padded={false} onDismiss={() => (catalogMarket = null)}>
    {#snippet titleTrailing()}
      <PopupMenu open={marketPicker} label={t("MARKETPLACES")} onOpenChange={(open) => (marketPicker = open)}>
        {#snippet triggerChild(props)}
          <TooltipIconButton label={t("MARKETPLACES")} class="[&_svg]:size-5" {...props}>
            <Store size={20} />
          </TooltipIconButton>
        {/snippet}
        {#each extensions?.marketplaces ?? [] as entry (entry.name)}
          <MenuItem
            text={entry.name}
            selected={entry.name === market}
            onclick={() => {
              marketPicker = false;
              void openCatalog(entry.name);
            }}
          />
        {/each}
      </PopupMenu>
    {/snippet}
    {#snippet buttons()}
      <Button onclick={() => (catalogMarket = null)} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    {#snippet header()}
      <InputField value={catalogQuery} oninput={(value) => (catalogQuery = value)} label={t("SEARCH")} singleLine />
    {/snippet}
    {#if !catalog}
      <CenteredProgress class="py-6" />
    {:else}
      {#each filteredCatalog as entry (entry.name)}
        <div class="px-5">
          <ListRow
            class="rounded-lg"
            padding="py-2.5 pr-3 pl-3"
            subtitleLines={2}
            title={entry.name + (entry.version ? ` - ${entry.version}` : "")}
            subtitle={entry.description}
            onclick={() => {
              if (entry.installed) {
                pluginMenu =
                  extensions?.plugins.find((item) => item.name === entry.name && item.marketplace === market) ?? null;
                catalogMarket = null;
              } else {
                installCandidate = entry;
              }
            }}
          >
            {#snippet trailing()}
              {@render stateDot(entry.installed)}
            {/snippet}
          </ListRow>
        </div>
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
          installCandidate = null;
          void runAction(() => claudeApi.pluginAction("install", `${entry.name}@${catalogMarket ?? ""}`));
        }}
       
      >
        {t("INSTALL")}
      </Button>
    {/snippet}
    <OutlinedPanel>
      <p class="text-body-sm text-on-surface-variant">{entry.description ?? entry.name}</p>
      {#if entry.version}
        <p class="text-label-md text-accent">{t("VERSION_LABEL", entry.version)}</p>
      {/if}
    </OutlinedPanel>
  </CompactDialog>
{/if}

{#if marketMenu}
  {@const market = marketMenu}
  <CompactDialog title={market.name} onDismiss={() => { cancelAction(); marketMenu = null; }}>
    {#snippet buttons()}
      <Button onclick={() => { cancelAction(); marketMenu = null; }} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    {#if market.repo}
      <OutlinedPanel class="mb-3">
        <p class="text-body-sm text-on-surface-variant">{market.repo}</p>
      </OutlinedPanel>
    {/if}
    <div class="flex flex-col gap-2.5">
      <ActionButton
        text={t("UPDATE_ACTION")}
        enabled={!busy}
        onclick={() => void runAction(() => claudeApi.marketplaceAction("update", market.name))}
        class="w-full"
      />
      <ActionButton
        text={t("DELETE")}
        enabled={!busy}
        onclick={() => (confirmMarketRemove = market)}
        class="w-full"
      />
    </div>
  </CompactDialog>
{/if}

{#if confirmMarketRemove}
  {@const market = confirmMarketRemove}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_FILE_CONFIRM", market.name)}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      confirmMarketRemove = null;
      marketMenu = null;
      void runAction(() => claudeApi.marketplaceAction("remove", market.name));
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

{#if mcpMenu}
  {@const server = mcpMenu}
  <CompactDialog title={server.name} onDismiss={() => { cancelAction(); mcpMenu = null; }}>
    {#snippet titleTrailing()}
      <CompactSwitch
        checked={server.enabled}
        enabled={!busy}
        onCheckedChange={() => void runAction(() => claudeApi.mcpToggle(server.name, !server.enabled))}
      />
    {/snippet}
    {#snippet buttons()}
      <Button onclick={() => { cancelAction(); mcpMenu = null; }} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    {#if server.detail || server.type}
      <OutlinedPanel class="mb-3">
        {#if server.type}
          <p class="text-label-md text-accent">{server.type}</p>
        {/if}
        {#if server.detail}
          <p class="wrap-anywhere text-body-sm text-on-surface-variant">{server.detail}</p>
        {/if}
      </OutlinedPanel>
    {/if}
    <ActionButton
      text={t("DELETE")}
      enabled={!busy}
      onclick={() => (confirmMcpRemove = server)}
      class="w-full"
    />
  </CompactDialog>
{/if}

{#if confirmMcpRemove}
  {@const server = confirmMcpRemove}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_FILE_CONFIRM", server.name)}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      confirmMcpRemove = null;
      mcpMenu = null;
      void runAction(() => claudeApi.mcpRemove(server.name));
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
          void runAction(() => claudeApi.mcpAdd(mcpName.trim(), mcpTarget.trim(), mcpTransport));
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
    </div>
  </CompactDialog>
{/if}
