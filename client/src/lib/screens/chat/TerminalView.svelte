<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import Network from "@lucide/svelte/icons/network";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import { tick } from "svelte";
  import { activeScope } from "$lib/app/activeScope.svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { osIcon } from "$lib/design/osIcons";
  import { shellIcon } from "$lib/design/shellIcons";
  import { sshAddress, sshStore } from "$lib/data/sshStore.svelte";
  import { paneFocus } from "$lib/data/paneFocus.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { terminalTabs, type TerminalTab } from "$lib/data/terminalTabs.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { listTerminals, listTerminalsWith, type TerminalInfo } from "$lib/services/terminalApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { sshLink } from "$lib/screens/terminal/sshLink";
  import SoftKeys from "$lib/screens/terminal/SoftKeys.svelte";
  import TerminalSurface from "$lib/screens/terminal/TerminalSurface.svelte";
  import SshHostsList from "$lib/screens/terminal/SshHostsList.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import TabStrip from "./TabStrip.svelte";

  interface Props {
    cwd: string[];
  }

  const { cwd }: Props = $props();

  let sessions = $state<TerminalInfo[]>([]);
  let menuOpen = $state(false);
  let unlocking = $state(false);
  let rejected = $state(false);
  let closing = $state<TerminalTab | null>(null);
  let managing = $state(false);

  const focused = $derived(activeScope() === "terminal");
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

  let unlocked = $state<boolean | null>(null);

  const refresh = async () => {
    if (!online) return;
    const listed = await listTerminals();
    unlocked = listed !== null;
    if (!listed) return;
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
      { id: `ssh:${profile.id}`, title: profile.name || profile.host, local: false, os: profile.os },
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
    securityKeys.set(key);
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

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !focused || !managing) return false;
      managing = false;
      return true;
    }),
  );

  $effect(() => {
    void refresh();
  });
</script>

{#snippet tabIcon(id: string)}
  {@const tab = terminalTabs.items.find((item) => item.id === id)}
  {@const Icon = tab ? (tab.local ? shellIcon(tab.shell) : osIcon(tab.os)) : null}
  {#if Icon}
    <Icon class="size-4 shrink-0" aria-hidden="true" />
  {:else}
    <SquareTerminal size={16} class="shrink-0" />
  {/if}
{/snippet}

{#snippet terminalActions()}
  {#if isTauri}
    <PopupMenu
      open={menuOpen}
      onOpenChange={(value) => {
        menuOpen = value;
        if (value) void refresh();
      }}
      label={t("MORE")}
    >
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("MORE")} {...props}>
          <EllipsisVertical />
        </TooltipIconButton>
      {/snippet}
      {#if sshStore.profiles.length}
        <MenuSub icon={Network} text={t("SSH_HOSTS")}>
          {#each sshStore.profiles as profile (profile.id)}
            {@const OsIcon = osIcon(profile.os)}
            <MenuItem
              icon={OsIcon ? undefined : SquareTerminal}
              text={profile.name || profile.host}
              description={sshAddress(profile)}
              onclick={() => connectSsh(profile)}
            >
              {#snippet leading()}
                {#if OsIcon}
                  <OsIcon class="size-4 shrink-0" aria-hidden="true" />
                {/if}
              {/snippet}
            </MenuItem>
          {/each}
        </MenuSub>
      {/if}
      <MenuItem icon={Settings2} text={t("MANAGE_SSH_HOSTS")} onclick={() => (managing = true)} />
    </PopupMenu>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative flex min-h-0 flex-1 flex-col"
  onpointerdowncapture={() => paneFocus.set("terminal")}
>
  <TabStrip
    items={terminalTabs.items.map((tab) => ({ id: tab.id, title: terminalTabs.titleOf(tab) }))}
    activeId={terminalTabs.activeId}
    onSelect={select}
    onNew={() => void create()}
    onClose={(id) => void closeTab(id)}
    onMove={(id, index) => terminalTabs.move(id, index)}
    newLabel={t("NEW_TERMINAL")}
    newShortcut="terminal.tab.new"
    emptyTitle={t("TERMINAL")}
    dot={false}
    sub
    {focused}
    trailing={terminalActions}
    leading={tabIcon}
  />

  <div
    class="relative min-h-0 flex-1 {terminalTabs.items.length
      ? 'mx-2 mb-2 overflow-hidden rounded-panel bg-terminal'
      : ''}"
  >
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
            onTitle={(title) => terminalTabs.report(tab.id, title)}
          />
        </div>
      {/if}
    {/each}

    {#if !terminalTabs.items.length && serverStatus.unavailable}
      <ServerUnavailable class="absolute inset-0" />
    {:else if !terminalTabs.items.length}
      <EmptyState
        loading={unlocked === null}
        icon={SquareTerminal}
        text={unlocked ? t("NO_TERMINALS") : t("TERMINAL_LOCKED")}
        class="absolute inset-0"
      >
        {#snippet action()}
          {#if unlocked === false}
            <ActionButton
              text={t("UNLOCK")}
              onclick={() => {
                rejected = false;
                unlocking = true;
              }}
            />
          {/if}
        {/snippet}
      </EmptyState>
    {/if}
  </div>

  {#if layout.touch && terminalTabs.activeId}
    <div class="flex shrink-0 items-center gap-2 px-2 pb-2">
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

  {#if managing}
    <div class="absolute inset-0 z-10">
      <SshHostsList
        onSelect={(profile) => {
          managing = false;
          connectSsh(profile);
        }}
        onBack={() => (managing = false)}
      />
    </div>
  {/if}
</div>

{#if unlocking}
  <SecurityKeyDialog
    title={t("TERMINAL_LOCKED")}
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
    text={t("CLOSE_TERMINAL_CONFIRM", terminalTabs.titleOf(tab))}
    confirmLabel={t("CLOSE")}
    danger
    onConfirm={() => confirmClose(tab)}
    onDismiss={() => (closing = null)}
  />
{/if}
