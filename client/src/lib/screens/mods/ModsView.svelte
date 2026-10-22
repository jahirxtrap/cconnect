<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Settings from "@lucide/svelte/icons/settings";
  import { untrack } from "svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import type { ModCommand } from "$lib/data/modModels";
  import { paneFocus } from "$lib/data/paneFocus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { commandText, takesArguments } from "$lib/services/capabilitiesApi";
  import { pluginKey, type Plugin } from "$lib/services/claudeApi";
  import PluginOptionsDialog from "$lib/screens/claude/PluginOptionsDialog.svelte";
  import type { ChatState } from "$lib/screens/chat/state.svelte";
  import PaneActions from "$lib/screens/chat/PaneActions.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import TabStrip from "$lib/screens/chat/TabStrip.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ModSite from "./ModSite.svelte";

  interface Props {
    chat: ChatState;
  }

  const { chat }: Props = $props();

  let menu = $state(false);
  let installed = $state<Plugin[]>([]);
  let optionsFor = $state<Plugin | null>(null);

  const MISSING = {
    off: { text: "MOD_PANES_OFF", setting: "mod_surfaces" },
    needs_persistent: { text: "MOD_PANES_NEED_PERSISTENT", setting: "persistent_sessions" },
  } as const;

  const mods = $derived(chat.mods);
  const loading = $derived(chat.modsState === "loading" || chat.transcriptLoading);
  const missing = $derived(
    chat.modsState === "off" || chat.modsState === "needs_persistent" ? MISSING[chat.modsState] : null,
  );
  const pane = $derived(mods.shown);
  const commands = $derived(mods.state.commands);
  const tabs = $derived(mods.state.panes.map((entry) => ({ id: entry.id, title: entry.title })));
  const focused = $derived(panes.focused === "right");
  const owners = $derived([...new Set(mods.state.panes.flatMap((entry) => entry.plugin ?? []))].sort().join(" "));
  const configurable = $derived(
    installed.find((plugin) => plugin.enabled && plugin.options && plugin.name === pane?.plugin) ?? null,
  );

  $effect(() => {
    if (!owners) return;
    let live = true;
    void chat.claude.extensions().then((found) => {
      if (live && found) installed = found.plugins;
    });
    return () => {
      live = false;
    };
  });

  const pick = (command: ModCommand) => {
    if (!takesArguments(command)) {
      chat.submit(commandText(command));
      return;
    }
    chat.pendingInput = commandText(command);
    if (layout.mobile) panes.setOpen(false);
  };

  const focusPane = (id: string, held: boolean) => {
    const wanted = held ? id : null;
    if (mods.state.focusedId !== wanted) mods.act("focus", { id: wanted });
  };

  let view = $state<HTMLElement | null>(null);

  const step = (by: number) => {
    const list = mods.state.panes;
    if (list.length < 2 || !pane) return;
    const at = list.findIndex((entry) => entry.id === pane.id);
    mods.act("show", { id: list[(at + by + list.length) % list.length].id });
  };

  useShortcut("mods.tab.close", () => pane && mods.act("close", { id: pane.id }));
  useShortcut("mods.tab.next", () => step(1));
  useShortcut("mods.tab.previous", () => step(-1));

  const focusSite = () => view?.querySelector<HTMLElement>("[data-mod-site]")?.focus({ preventScroll: true });

  $effect(() => paneFocus.register("mods", focusSite));

  $effect(() => {
    if (!pane || mods.raised !== pane.id) return;
    untrack(() => {
      mods.raised = null;
      focusSite();
    });
  });
</script>

{#snippet commandMenu()}
  {#if commands.length}
    <PopupMenu open={menu} label={t("COMMANDS")} align="end" onOpenChange={(open) => (menu = open)}>
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("COMMANDS")} class="size-8" {...props}>
          <EllipsisVertical />
        </TooltipIconButton>
      {/snippet}
      {#each commands as command (`${command.plugin}:${command.name}`)}
        <MenuItem
          text="/{command.name}"
          description={command.description || command.plugin}
          onclick={() => pick(command)}
        />
      {/each}
    </PopupMenu>
  {/if}
{/snippet}

{#snippet paneActions()}
  {#if configurable}
    {@const plugin = configurable}
    <TooltipIconButton label={t("MOD_OPTIONS", plugin.name)} class="size-8" onclick={() => (optionsFor = plugin)}>
      <Settings />
    </TooltipIconButton>
  {/if}
  {@render commandMenu()}
{/snippet}

{#snippet trailing()}
  <PaneActions actions={paneActions} />
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={view} class="flex min-h-0 flex-1 flex-col" onpointerdowncapture={() => paneFocus.set("mods")}>
{#if tabs.length}
  <TabStrip
    items={tabs}
    activeId={pane?.id ?? null}
    onSelect={(id) => mods.act("show", { id })}
    onClose={(id) => mods.act("close", { id })}
    emptyTitle={t("MODS")}
    dot={false}
    {focused}
    {trailing}
  />
{:else}
  <PaneHeader title={t("MODS")} actions={commands.length ? commandMenu : undefined} />
{/if}

{#if loading}
  <CenteredProgress class="min-h-0 flex-1" />
{:else if missing}
  <EmptyState text={t(missing.text)} class="min-h-0 flex-1">
    {#snippet action()}
      <Button variant="outlined" onclick={() => navigation.openSettings(missing.setting)}>{t("SETTINGS")}</Button>
    {/snippet}
  </EmptyState>
{:else if !mods.state.surface}
  <EmptyState text={t("MOD_PANES_IDLE")} class="min-h-0 flex-1" />
{:else if !pane}
  <EmptyState text={t("MOD_PANES_EMPTY")} class="min-h-0 flex-1" />
{:else}
  {#key pane.id}
    <ModSite
      {mods}
      component="Pane"
      instanceId={pane.id}
      focused={mods.state.focusedId === pane.id}
      onFocusChange={(held) => focusPane(pane.id, held)}
      onEscape={pane.closeOnEscape ? () => mods.act("close", { id: pane.id }) : null}
      class="min-h-0 flex-1"
      bodyClass="px-4 py-3"
    >
      {#snippet pending()}
        <CenteredProgress class="flex-1" />
      {/snippet}
      {#snippet blank()}
        <EmptyState text={t("MOD_PANE_BLANK")} class="flex-1" />
      {/snippet}
    </ModSite>
  {/key}
{/if}
</div>

{#if optionsFor}
  {@const plugin = optionsFor}
  <PluginOptionsDialog
    api={chat.claude}
    plugin={pluginKey(plugin)}
    title={plugin.name}
    onDismiss={() => (optionsFor = null)}
  />
{/if}
