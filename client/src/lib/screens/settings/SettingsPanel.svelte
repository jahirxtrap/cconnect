<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import AccountsSection from "$lib/screens/claude/AccountsSection.svelte";
  import ClaudeCliSection from "$lib/screens/claude/ClaudeCliSection.svelte";
  import ClaudeUsageSection from "$lib/screens/claude/ClaudeUsageSection.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import SearchBar, { HEADER_SEARCH_CLASS } from "$lib/ui/SearchBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AboutGroup from "./AboutGroup.svelte";
  import BackgroundSection from "./BackgroundSection.svelte";
  import ClientSection from "./ClientSection.svelte";
  import ConnectivitySection from "./ConnectivitySection.svelte";
  import RecoverySection from "./RecoverySection.svelte";
  import { isSettingsSection, SETTINGS_SECTIONS, type SettingsSection } from "./sections";
  import ServerSection from "./ServerSection.svelte";
  import SettingsResults from "./SettingsResults.svelte";
  import { useSettingsPage } from "./settingsPage.svelte";

  const sectionOf = (value: string | null): SettingsSection =>
    isSettingsSection(value) ? value : backend.configured ? "general" : "connectivity";

  let section = $state<SettingsSection>(sectionOf(navigation.sub));
  let scroller = $state<HTMLDivElement | null>(null);

  const chat = $derived(tabs.state);
  const serverReady = $derived(backend.configured && chat.connected);
  const claudePending = $derived(chat.link === "disconnected" ? t("SERVER_UNAVAILABLE") : t("LOADING"));
  const showsServer = $derived(section === "general" || section === "server" || section === "claude");

  const select = (id: SettingsSection) => {
    section = id;
    if (scroller) scroller.scrollTop = 0;
    if (id === "general") navigation.clearSub();
    else navigation.showSub(id);
  };

  const page = useSettingsPage(select, true);

  $effect(() => {
    section = sectionOf(navigation.sub);
  });
</script>

{#snippet sectionView(id: SettingsSection)}
  {#if id === "general"}
    <ClientSection />
    <BackgroundSection />
    <ConnectivitySection />
    <ServerSection tick={page.tick} flash={page.highlight.is("server")} />
    <RecoverySection onChanged={page.changed} />
    <AboutGroup flash={page.highlight.is("about")} />
  {:else if id === "client"}
    <ClientSection />
  {:else if id === "background"}
    <BackgroundSection />
  {:else if id === "connectivity"}
    <ConnectivitySection />
  {:else if id === "server"}
    <ServerSection tick={page.tick} flash={page.highlight.is("server")} />
  {:else if id === "claude"}
    <ClaudeUsageSection tick={page.tick} pending={claudePending} />
    <AccountsSection enabled={serverReady} onChanged={() => void page.refresh()} />
    <ClaudeCliSection enabled={serverReady} tick={page.tick} pending={claudePending} flash={page.highlight.is("cli")} />
  {:else if id === "recovery"}
    <RecoverySection onChanged={page.changed} />
  {:else}
    <AboutGroup flash={page.highlight.is("about")} />
  {/if}
{/snippet}

<div class="flex h-full min-h-0 flex-col">
  <AppTopBar title={t("SETTINGS")}>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => navigation.closeSettings()}>
        <ArrowLeft />
      </TooltipIconButton>
    {/snippet}
    {#snippet controls()}
      <SearchBar value={page.query} oninput={page.search} placeholder={t("SETTINGS_SEARCH")} class={HEADER_SEARCH_CLASS} />
    {/snippet}
    {#snippet actions()}
      {#if showsServer}
        <TooltipIconButton label={t("REFRESH")} shortcut="window.refresh" onclick={() => void page.refresh()}>
          <RotateCw />
        </TooltipIconButton>
      {/if}
    {/snippet}
  </AppTopBar>
  <div class="flex min-h-0 flex-1 gap-(--page-inset) pl-(--page-inset)">
    <nav class="flex w-52 shrink-0 flex-col gap-0.5">
      {#each SETTINGS_SECTIONS as item (item.id)}
        {@const current = section === item.id && !page.searching}
        <Pressable
          onclick={() => select(item.id)}
          hover={!current}
          class="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-body-md {current
            ? 'bg-surface-variant text-on-surface'
            : 'text-on-surface-variant'}"
        >
          <item.icon size={16} class="shrink-0 {current ? 'text-accent' : ''}" />
          <span class="min-w-0 flex-1 truncate text-left">{t(item.label)}</span>
        </Pressable>
      {/each}
    </nav>

    <div class="flex min-w-0 flex-1 flex-col">
      <PullToRefresh
        refreshing={page.refreshing}
        onRefresh={() => void page.refresh()}
        bind:scroller
        class="pr-(--page-inset) pb-(--page-inset)"
      >
        {#if page.searching}
          <SettingsResults query={page.query} onSelect={page.reveal} />
          {#if page.hosting}
            <div class="hidden">{@render sectionView(page.hosting)}</div>
          {/if}
        {:else}
          {@render sectionView(section)}
        {/if}
      </PullToRefresh>
    </div>
  </div>
</div>
