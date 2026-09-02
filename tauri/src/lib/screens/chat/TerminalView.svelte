<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import X from "@lucide/svelte/icons/x";
  import { tick } from "svelte";
  import { sshAddress, sshStore } from "$lib/data/sshStore.svelte";
  import { paneFocus } from "$lib/data/paneFocus.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { terminalKeys } from "$lib/data/terminalKeys.svelte";
  import { terminalTabs, type TerminalTab } from "$lib/data/terminalTabs.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { listTerminals, listTerminalsWith, type TerminalInfo } from "$lib/services/terminalApi";
  import Button from "$lib/ui/Button.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { sshLink } from "$lib/screens/terminal/sshLink";
  import SoftKeys from "$lib/screens/terminal/SoftKeys.svelte";
  import { TERMINAL_BACKGROUND } from "$lib/screens/terminal/theme";
  import TerminalSurface from "$lib/screens/terminal/TerminalSurface.svelte";
  import TerminalUnlockDialog from "$lib/screens/terminal/TerminalUnlockDialog.svelte";
  import TabStrip from "./TabStrip.svelte";

  interface Props {
    cwd: string[];
    onClose: () => void;
    onChat?: (() => void) | null;
  }

  const { cwd, onClose, onChat = null }: Props = $props();

  let sessions = $state<TerminalInfo[]>([]);
  let menuOpen = $state(false);
  let unlocking = $state(false);
  let rejected = $state(false);
  let closing = $state<TerminalTab | null>(null);

  const focused = $derived(paneFocus.active === "terminal");
  const online = $derived(serverStatus.online);
  const RESERVED_KEYS = ["t", "w"];
  const panes: Record<string, ReturnType<typeof TerminalSurface> | null> = {};

  const focusActive = () => {
    const id = terminalTabs.activeId;
    if (id === null) return;
    void tick().then(() => panes[id]?.focus());
  };

  const select = (id: string) => {
    terminalTabs.select(id);
    focusActive();
  };

  const unlocked = $derived(!!terminalKeys.current);
  const hasExtras = $derived(isTauri && sshStore.profiles.length > 0);

  const refresh = async () => {
    if (!online || !terminalKeys.current) return;
    const listed = (await listTerminals()) ?? [];
    sessions = listed;
    terminalTabs.sync(listed);
  };

  const create = async () => {
    if (!online) return;
    if (!unlocked) {
      rejected = false;
      unlocking = true;
      return;
    }
    const created = await terminalTabs.create(cwd);
    if (!created) {
      rejected = true;
      unlocking = true;
      return;
    }
    sessions = [...sessions, created];
    focusActive();
  };

  const connectSsh = (profile: (typeof sshStore.profiles)[number]) => {
    terminalTabs.open(
      { id: `ssh:${profile.id}`, title: profile.name || profile.host, local: false },
      (hooks, cols, rows) => sshLink(profile, hooks, cols, rows),
    );
    focusActive();
  };

  const unlock = async (key: string) => {
    const listed = await listTerminalsWith(key);
    if (listed === null) {
      rejected = true;
      return;
    }
    terminalKeys.set(key);
    sessions = listed;
    unlocking = false;
    rejected = false;
  };

  const drop = async (tab: TerminalTab) => {
    await terminalTabs.drop(tab);
    await refresh();
    focusActive();
  };

  const closeTab = async (id: string) => {
    const tab = terminalTabs.items.find((item) => item.id === id);
    if (!tab) return;
    if (await terminalTabs.needsConfirm(tab)) closing = tab;
    else await drop(tab);
  };

  const confirmClose = (tab: TerminalTab) => {
    closing = null;
    void drop(tab);
  };

  useShortcut("terminal.tab.new", () => void create());
  useShortcut("terminal.tab.close", () => {
    if (terminalTabs.activeId !== null) closeTab(terminalTabs.activeId);
  });
  useShortcut("terminal.tab.next", () => terminalTabs.selectNext());
  useShortcut("terminal.tab.previous", () => terminalTabs.selectPrev());

  $effect(() => paneFocus.register("terminal", focusActive));

  $effect(() => {
    void refresh();
  });
</script>

{#snippet headerActions()}
  {#if hasExtras}
    <PopupMenu
      open={menuOpen}
      onOpenChange={(value) => {
        menuOpen = value;
        if (value) void refresh();
      }}
      label={t("MORE")}
      align="end"
    >
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("MORE")} class="size-8" {...props}>
          <EllipsisVertical />
        </TooltipIconButton>
      {/snippet}
      {#if isTauri && sshStore.profiles.length}
        <MenuSub text={t("SSH_HOSTS")}>
          {#each sshStore.profiles as profile (profile.id)}
            <MenuItem
              text={profile.name || profile.host}
              description={sshAddress(profile)}
              onclick={() => connectSsh(profile)}
            />
          {/each}
        </MenuSub>
      {/if}
    </PopupMenu>
  {/if}
  {#if onChat}
    <TooltipIconButton label={t("CHAT")} onclick={onChat} class="size-8">
      <MessageSquare />
    </TooltipIconButton>
  {/if}
  <TooltipIconButton
    label={layout.mobile ? t("CLOSE") : t("PANEL_RIGHT")}
    shortcut="panel.right"
    onclick={onClose}
    class="size-8"
  >
    {#if layout.mobile}
      <X />
    {:else}
      <PanelRightClose />
    {/if}
  </TooltipIconButton>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="flex h-full flex-col bg-surface {layout.mobile ? '' : 'border-l border-outline-variant'}"
  onpointerdowncapture={() => paneFocus.set("terminal")}
>
  <TabStrip
    items={terminalTabs.items}
    activeId={terminalTabs.activeId}
    onSelect={select}
    onNew={() => void create()}
    onClose={(id) => void closeTab(id)}
    onMove={(id, index) => terminalTabs.move(id, index)}
    newLabel={t("NEW_TERMINAL")}
    newShortcut="terminal.tab.new"
    emptyTitle={t("TERMINAL")}
    dot={false}
    {focused}
    trailing={headerActions}
  />

  <div class="relative min-h-0 flex-1" style="background: {TERMINAL_BACKGROUND}">
    {#each terminalTabs.items as tab (tab.id)}
      {@const connect = terminalTabs.connectorOf(tab.id)}
      {#if connect}
        <div class="absolute inset-0 {tab.id === terminalTabs.activeId ? '' : 'pointer-events-none invisible'}">
          <TerminalSurface
            bind:this={panes[tab.id]}
            {connect}
            autofocus={false}
            reserved={RESERVED_KEYS}
            pty={tab.pty}
          />
        </div>
      {/if}
    {/each}

    {#if !terminalTabs.items.length}
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
        <p class="text-body-md text-on-surface-variant">
          {!online ? t("DISCONNECTED") : unlocked ? t("NO_TERMINALS") : t("TERMINAL_LOCKED")}
        </p>
        {#if online && !unlocked}
          <Button
            onclick={() => {
              rejected = false;
              unlocking = true;
            }}
          >
            {t("UNLOCK")}
          </Button>
        {/if}
      </div>
    {/if}
  </div>

  {#if layout.touch && terminalTabs.activeId}
    <div class="flex shrink-0 items-center gap-2 border-t border-outline-variant bg-surface px-3 py-2">
      <SoftKeys onKey={(bytes) => panes[terminalTabs.activeId ?? ""]?.sendKey(bytes)} />
      <TooltipIconButton
        label={t("KEYBOARD")}
        tooltip={false}
        class="size-8"
        onclick={() => panes[terminalTabs.activeId ?? ""]?.toggleKeyboard()}
      >
        <Keyboard />
      </TooltipIconButton>
    </div>
  {/if}
</div>

{#if unlocking}
  <TerminalUnlockDialog
    {rejected}
    onConfirm={(key) => void unlock(key)}
    onDismiss={() => {
      unlocking = false;
      rejected = false;
    }}
  />
{/if}

{#if closing}
  {@const tab = closing}
  <ConfirmDialog
    title={t("CLOSE")}
    text={t("CLOSE_TERMINAL_CONFIRM", tab.title)}
    confirmLabel={t("CLOSE")}
    onConfirm={() => confirmClose(tab)}
    onDismiss={() => (closing = null)}
  />
{/if}
