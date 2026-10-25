<script lang="ts">
  import { untrack } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Server from "@lucide/svelte/icons/server";
  import { navigation } from "$lib/app/navigation.svelte";
  import { useHighlight } from "$lib/app/useHighlight.svelte";
  import { isTouch, openExternal } from "$lib/platform";
  import { useRefreshTick } from "$lib/platform/useRefreshTick.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import { accountsStore } from "$lib/data/accountsStore.svelte";
  import { claudeRefresh } from "$lib/data/claudeRefresh.svelte";
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { settingsApi } from "$lib/services/settingsApi";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import { rem } from "$lib/ui/rem";
  import SearchBar, { HEADER_SEARCH_CLASS } from "$lib/ui/SearchBar.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ClaudeDetail, { CLAUDE_KINDS, CLAUDE_TABS, STATUS_PAGE, type ClaudeKind } from "./ClaudeDetail.svelte";
  import ClaudeActions from "./ClaudeActions.svelte";
  import ClaudeSections from "./ClaudeSections.svelte";

  claudeStatus.forget();

  const GENERAL = "general";

  let envOpen = $state(false);
  let accountOpen = $state(false);
  let query = $state("");
  let width = $state(0);
  let deficit = $state(0);
  let searchNeeded = $state(0);
  let tabsNeeded = $state(0);
  let pushed = $state(false);

  const highlight = useHighlight();
  const chat = $derived(tabs.state);
  const detail = $derived(
    (CLAUDE_KINDS as readonly string[]).includes(navigation.sub ?? "") ? (navigation.sub as ClaudeKind) : null,
  );
  const tabbed = $derived(navigation.centered && (!tabsNeeded || width >= tabsNeeded));
  const searchFits = $derived(!searchNeeded || width >= searchNeeded);
  const tabIds = [GENERAL, ...CLAUDE_KINDS] as const;
  const searchable = $derived(detail !== null && detail !== "status");
  const loggedAccounts = $derived(accountsStore.items.filter((account) => account.loggedIn));
  const tick = $derived(claudeRefresh.tick + (chat.connected ? 1 : 0));
  const refreshing = $derived(claudeRefresh.refreshing);
  const SECTION_REM = 24;
  const SECTION_GAP_REM = 1;
  const MAX_COLUMNS = 4;
  let sectionsWidth = $state(0);
  const columns = $derived(
    tabbed
      ? Math.max(1, Math.min(MAX_COLUMNS, Math.floor((sectionsWidth / rem() + SECTION_GAP_REM) / (SECTION_REM + SECTION_GAP_REM))))
      : 1,
  );

  const refresh = () => claudeRefresh.run();

  const leave = () => {
    if (pushed) navigation.closeSub();
    else navigation.clearSub();
  };

  const selectTab = (index: number) => {
    const id = tabIds[index];
    query = "";
    if (id === GENERAL) leave();
    else navigation.showSub(id);
  };

  const open = (kind: ClaudeKind) => {
    if (tabbed) {
      navigation.showSub(kind);
      return;
    }
    navigation.openSub(kind);
    pushed = true;
  };

  useRefreshTick(() => void refresh());

  $effect(() => {
    if (navigation.sub === null) pushed = false;
  });

  $effect(() => {
    if (!tabbed) deficit = 0;
  });

  $effect(() => {
    if (!searchFits) query = "";
  });

  $effect(() => {
    const missing = deficit;
    if (missing <= 0) return;
    untrack(() => {
      if (!tabbed) return;
      if (searchFits) searchNeeded = width + missing;
      else tabsNeeded = width + missing;
    });
  });

  $effect(() => {
    void tick;
    void backend.activeId;
    void accountsStore.load();
  });
</script>

{#snippet sharedActions()}
  {#if loggedAccounts.length > 1}
    <TooltipIconButton label={t("ACCOUNT")} onclick={() => (accountOpen = true)}>
      <CircleUser />
    </TooltipIconButton>
  {/if}
  <TooltipIconButton label={t("ENVIRONMENT")} enabled={!settings.environmentLocked} onclick={() => (envOpen = true)}>
    <Server />
  </TooltipIconButton>
  {#if !isTouch}
    <ClaudeActions />
  {/if}
{/snippet}

{#snippet sections()}
  <PullToRefresh {refreshing} onRefresh={() => void refresh()} class="[scrollbar-gutter:stable]">
    <div class="px-(--page-inset) pb-(--page-inset)">
      <div bind:clientWidth={sectionsWidth}>
        <ClaudeSections
          {tick}
          {columns}
          flashCli={highlight.is("cli")}
          onOpen={open}
          onAccountsChanged={() => void refresh()}
        />
      </div>
    </div>
  </PullToRefresh>
{/snippet}

<div bind:clientWidth={width} class="flex h-full flex-col">
  {#if tabbed}
    <AppTopBar title={t("CLAUDE")} server bind:deficit>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
          <ArrowLeft />
        </TooltipIconButton>
      {/snippet}
      {#snippet controls()}
        {#if searchFits}
          <div class="flex {HEADER_SEARCH_CLASS} min-w-40 shrink {searchable ? '' : 'invisible'}">
            <SearchBar value={query} oninput={(value) => (query = value)} placeholder={t("SEARCH")} class="flex-1" />
          </div>
        {/if}
        <SegmentedButtons
          options={[t("SETTINGS_GENERAL"), ...CLAUDE_KINDS.map((kind) => t(CLAUDE_TABS[kind]))]}
          selected={detail ? tabIds.indexOf(detail) : 0}
          onSelect={selectTab}
        />
      {/snippet}
      {#snippet actions()}
        {#if detail === "status"}
          <TooltipIconButton label={t("STATUS_OPEN_PAGE")} onclick={() => openExternal(STATUS_PAGE)}>
            <ExternalLink />
          </TooltipIconButton>
        {/if}
        {@render sharedActions()}
      {/snippet}
    </AppTopBar>
    {#if detail}
      {#key detail}
        <ClaudeDetail kind={detail} embedded {query} onClose={leave} />
      {/key}
    {:else}
      {@render sections()}
    {/if}
  {:else if detail}
    <ClaudeDetail kind={detail} onClose={leave} />
  {:else}
    <AppTopBar title={t("CLAUDE")} server>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
          <ArrowLeft />
        </TooltipIconButton>
      {/snippet}
      {#snippet actions()}
        {@render sharedActions()}
      {/snippet}
    </AppTopBar>
    {@render sections()}
  {/if}
</div>

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
    selected={accountsStore.defaultId}
    onSelect={(id) => {
      void settingsApi.update({ account: id }).then(() => void refresh());
    }}
    onDismiss={() => (accountOpen = false)}
  />
{/if}
