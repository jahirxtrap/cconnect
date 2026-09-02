<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import X from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { pushDismiss } from "$lib/app/dismissStack";
  import { navigation } from "$lib/app/navigation.svelte";
  import { useHighlight } from "$lib/app/useHighlight.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import { desktop } from "$lib/platform/desktop.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AccountsSection from "$lib/screens/claude/AccountsSection.svelte";
  import ClaudeCliSection from "$lib/screens/claude/ClaudeCliSection.svelte";
  import ClaudeUsageSection from "$lib/screens/claude/ClaudeUsageSection.svelte";
  import AboutGroup from "./AboutGroup.svelte";
  import BackgroundSection from "./BackgroundSection.svelte";
  import ClientSection from "./ClientSection.svelte";
  import ConnectivitySection from "./ConnectivitySection.svelte";
  import RecoverySection from "./RecoverySection.svelte";
  import ServerSection from "./ServerSection.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  type Section =
    | "general"
    | "client"
    | "background"
    | "connectivity"
    | "server"
    | "claude"
    | "recovery"
    | "about";

  const SECTION_IDS = [
    "general",
    "client",
    "background",
    "connectivity",
    "server",
    "claude",
    "recovery",
    "about",
  ];

  const sectionOf = (value: string | null): Section =>
    value && SECTION_IDS.includes(value)
      ? (value as Section)
      : backend.configured
        ? "general"
        : "connectivity";

  let section = $state<Section>(sectionOf(navigation.sub));
  let refreshTick = $state(0);
  let refreshing = $state(false);

  const tick = $derived(refreshTick + desktop.refreshTick);
  const showsServer = $derived(
    section === "general" || section === "server" || section === "claude",
  );
  const serverReady = $derived(backend.configured && tabs.state.connected);

  const sections = $derived<{ id: Section; label: string }[]>([
    { id: "general", label: t("SETTINGS_GENERAL") },
    { id: "client", label: t("SETTINGS_CLIENT") },
    { id: "background", label: t("BACKGROUND_GROUP") },
    { id: "connectivity", label: t("SETTINGS_CONNECTIVITY") },
    { id: "server", label: t("SETTINGS_SERVER") },
    { id: "claude", label: t("CLAUDE") },
    { id: "recovery", label: t("SETTINGS_RECOVERY") },
    { id: "about", label: t("ABOUT") },
  ]);

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

  const select = (id: Section) => {
    section = id;
    if (id === "general") navigation.closeSub();
    else navigation.openSub(id);
  };

  $effect(() => {
    section = sectionOf(navigation.sub);
  });

  const highlight = useHighlight((target) => select(target === "cli" ? "claude" : "about"));
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
        {#each sections as item (item.id)}
          <Pressable
            onclick={() => select(item.id)}
            hover={false}
            class="flex w-full items-center rounded-item px-2 py-2 text-body-md transition-colors {section ===
            item.id
              ? 'bg-accent/14 font-semibold text-accent hover:bg-accent/21'
              : 'hover:bg-on-surface/8'}"
          >
            <span class="min-w-0 flex-1 truncate text-left">{item.label}</span>
          </Pressable>
        {/each}
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-14 shrink-0 items-center justify-end px-2">
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
            {#if section === "general"}
              <ClientSection />
              <BackgroundSection />
              <ConnectivitySection />
              <ServerSection {tick} />
              <RecoverySection onChanged={() => refreshTick++} />
              <AboutGroup />
            {:else if section === "client"}
              <ClientSection />
            {:else if section === "background"}
              <BackgroundSection />
            {:else if section === "connectivity"}
              <ConnectivitySection />
            {:else if section === "server"}
              <ServerSection {tick} />
            {:else if section === "claude"}
              <ClaudeCliSection
                enabled={serverReady}
                {tick}
                pending={t("LOADING")}
                flash={highlight.is("cli")}
              />
              <ClaudeUsageSection {tick} pending={t("LOADING")} />
              <AccountsSection enabled={serverReady} onChanged={() => void refresh()} />
            {:else if section === "recovery"}
              <RecoverySection onChanged={() => refreshTick++} />
            {:else}
              <AboutGroup />
            {/if}
          </div>
        </PullToRefresh>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
