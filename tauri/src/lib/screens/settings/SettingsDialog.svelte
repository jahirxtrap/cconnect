<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import X from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { pushDismiss } from "$lib/app/dismissStack";
  import { navigation } from "$lib/app/navigation.svelte";
  import { useHighlight } from "$lib/app/useHighlight.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import { useRefreshTick } from "$lib/platform/useRefreshTick.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AccountsSection from "$lib/screens/claude/AccountsSection.svelte";
  import ClaudeCliSection from "$lib/screens/claude/ClaudeCliSection.svelte";
  import ClaudeUsageSection from "$lib/screens/claude/ClaudeUsageSection.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import AboutGroup from "./AboutGroup.svelte";
  import BackgroundSection from "./BackgroundSection.svelte";
  import ClientSection from "./ClientSection.svelte";
  import ConnectivitySection from "./ConnectivitySection.svelte";
  import RecoverySection from "./RecoverySection.svelte";
  import { isSettingsSection, SETTINGS_SECTIONS, type SettingsSection } from "./sections";
  import { entryFor, type SettingsEntry } from "./settingsIndex";
  import SettingsResults from "./SettingsResults.svelte";
  import ServerSection from "./ServerSection.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const sectionOf = (value: string | null): SettingsSection =>
    isSettingsSection(value) ? value : backend.configured ? "general" : "connectivity";

  let section = $state<SettingsSection>(sectionOf(navigation.sub));
  let refreshTick = $state(0);
  let refreshing = $state(false);

  const tick = $derived(refreshTick);
  const serverReady = $derived(backend.configured && tabs.state.connected);
  const claudePending = $derived(
    tabs.state.link === "disconnected" ? t("SERVER_UNAVAILABLE") : t("LOADING"),
  );

  useRefreshTick(() => void refresh());
  const showsServer = $derived(
    section === "general" || section === "server" || section === "claude",
  );

  const MIN_REFRESH_MS = 600;

  const refresh = async () => {
    if (refreshing) return;
    refreshing = true;
    refreshTick++;
    await new Promise((done) => setTimeout(done, MIN_REFRESH_MS));
    refreshing = false;
  };


  $effect(() => {
    if (tick === 0) return;
    void serverStatus.refresh();
  });

  $effect(() => pushDismiss(() => onDismiss()));

  const select = (id: SettingsSection) => {
    section = id;
    if (id === "general") navigation.clearSub();
    else navigation.openSub(id);
  };

  $effect(() => {
    section = sectionOf(navigation.sub);
  });

  const highlight = useHighlight((target) => select(entryFor(target)?.section ?? "about"));

  let query = $state("");
  let hosting = $state<SettingsSection | null>(null);

  const reveal = (entry: SettingsEntry) => {
    hosting = entry.dialog ? entry.section : null;
    if (!entry.dialog) query = "";
    navigation.openSettings(entry.id);
  };
</script>

<Dialog.Root open onOpenChange={(value) => !value && onDismiss()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-60 bg-black/60" />
    <Dialog.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      class="menu-surface fixed inset-0 z-60 m-auto flex h-[min(44rem,88%)] w-[min(56rem,calc(100vw-3rem))] overflow-hidden rounded-lg border-2 border-outline-variant bg-surface shadow-xl"
    >
      <div class="flex w-52 shrink-0 flex-col border-r border-outline-variant px-2 pb-2">
        <Dialog.Title class="flex h-14 shrink-0 items-center truncate px-2 text-dialog-title">
          {t("SETTINGS")}
        </Dialog.Title>
        {#each SETTINGS_SECTIONS as item (item.id)}
          <Pressable
            onclick={() => select(item.id)}
            hover={false}
            class="flex w-full items-center rounded-item px-2 py-2 text-body-md transition-colors {section ===
            item.id
              ? 'bg-accent/14 font-semibold text-accent hover:bg-accent/21'
              : 'hover:bg-on-surface/8'}"
          >
            <span class="min-w-0 flex-1 truncate text-left">{t(item.label)}</span>
          </Pressable>
        {/each}
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-14 shrink-0 items-center px-2">
          <SearchBar
            value={query}
            oninput={(value) => {
              query = value;
              hosting = null;
            }}
            placeholder={t("SETTINGS_SEARCH")}
            class="mr-1 flex-1"
          />
          {#if !isTouch && showsServer}
            <TooltipIconButton
              label={t("REFRESH")}
              shortcut="window.refresh"
              class="size-9 [&_svg]:size-5"
              onclick={() => void refresh()}
            >
              <RotateCw />
            </TooltipIconButton>
          {/if}
          <TooltipIconButton label={t("CLOSE")} class="size-9 [&_svg]:size-5" onclick={onDismiss}>
            <X />
          </TooltipIconButton>
        </div>
        <PullToRefresh {refreshing} onRefresh={() => void refresh()}>
          <div class="px-4 pb-4">
            {#snippet sectionView(id: SettingsSection)}
              {#if id === "general"}
                <ClientSection />
                <BackgroundSection />
                <ConnectivitySection />
                <ServerSection {tick} flash={highlight.is("server")} />
                <RecoverySection onChanged={() => refreshTick++} />
                <AboutGroup flash={highlight.is("about")} />
              {:else if id === "client"}
                <ClientSection />
              {:else if id === "background"}
                <BackgroundSection />
              {:else if id === "connectivity"}
                <ConnectivitySection />
              {:else if id === "server"}
                <ServerSection {tick} flash={highlight.is("server")} />
              {:else if id === "claude"}
                <ClaudeUsageSection {tick} pending={claudePending} />
                <AccountsSection enabled={serverReady} onChanged={() => void refresh()} />
                <ClaudeCliSection
                  enabled={serverReady}
                  {tick}
                  pending={claudePending}
                  flash={highlight.is("cli")}
                />
              {:else if id === "recovery"}
                <RecoverySection onChanged={() => refreshTick++} />
              {:else}
                <AboutGroup flash={highlight.is("about")} />
              {/if}
            {/snippet}

            {#if query.trim()}
              <SettingsResults {query} onSelect={reveal} />
              {#if hosting}
                <div class="hidden">{@render sectionView(hosting)}</div>
              {/if}
            {:else}
              {@render sectionView(section)}
            {/if}
          </div>
        </PullToRefresh>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
