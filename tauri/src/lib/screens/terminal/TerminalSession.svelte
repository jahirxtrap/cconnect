<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import Eraser from "@lucide/svelte/icons/eraser";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Pause from "@lucide/svelte/icons/pause";
  import Square from "@lucide/svelte/icons/square";
  import X from "@lucide/svelte/icons/x";
  import { sshStore, type SshProfile } from "$lib/data/sshStore.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri, isTouch } from "$lib/platform";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { IconSource } from "$lib/ui/icons";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import { TerminalEmulator } from "./emulator.svelte";
  import TerminalView from "./TerminalView.svelte";

  interface Props {
    profile: SshProfile;
    onClose: () => void;
  }

  const { profile, onClose }: Props = $props();

  const INITIAL_COLS = 80;
  const INITIAL_ROWS = 24;
  const RESIZE_DEBOUNCE_MS = 50;
  const TERMINAL_BACKGROUND = "#000000";
  const TERMINAL_FOREGROUND = "#ffffff";

  // ESC = 0x1b; arrows = ESC + "[A/B/C/D"; Ctrl+letter = letter - 64.
  const SOFT_KEYS: Array<{ label?: string; icon?: IconSource; title: string; bytes: number[] }> = [
    { label: "Esc", title: "Esc", bytes: [0x1b] },
    { label: "Tab", title: "Tab", bytes: [0x09] },
    { icon: ChevronUp, title: "↑", bytes: [0x1b, 0x5b, 0x41] },
    { icon: ChevronDown, title: "↓", bytes: [0x1b, 0x5b, 0x42] },
    { icon: ChevronLeft, title: "←", bytes: [0x1b, 0x5b, 0x44] },
    { icon: ChevronRight, title: "→", bytes: [0x1b, 0x5b, 0x43] },
    { icon: Square, title: "Ctrl+C", bytes: [0x03] },
    { icon: LogOut, title: "Ctrl+D", bytes: [0x04] },
    { icon: Eraser, title: "Ctrl+L", bytes: [0x0c] },
    { icon: Pause, title: "Ctrl+Z", bytes: [0x1a] },
    { label: "Home", title: "Home", bytes: [0x1b, 0x5b, 0x48] },
    { label: "End", title: "End", bytes: [0x1b, 0x5b, 0x46] },
  ];

  let error = $state<string | null>(null);
  let status = $state<"connecting" | "connected" | "closed" | "failed">("connecting");
  let emulator = $state<TerminalEmulator | null>(null);
  let view = $state<ReturnType<typeof TerminalView> | null>(null);
  let disconnect = $state<(() => void) | null>(null);

  const statusLabel = $derived(
    status === "connecting"
      ? t("SSH_CONNECTING")
      : status === "connected"
        ? t("SSH_CONNECTED")
        : status === "closed"
          ? t("SSH_CLOSED")
          : t("CONNECTION_ERROR"),
  );

  const sendKey = (bytes: number[]) => {
    emulator?.send(new Uint8Array(bytes));
    view?.focus();
  };

  $effect(() => {
    if (!isTauri) return;

    const id = crypto.randomUUID();
    let disposed = false;
    let ready = false;
    const unlisten: Array<() => void> = [];

    const invoker = import("@tauri-apps/api/core");
    const send = (data: Uint8Array) => {
      if (!ready) return;
      void invoker.then(({ invoke }) => invoke("ssh_send", { id, data: Array.from(data) }));
    };
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resize = (cols: number, rows: number) => {
      if (!ready) return;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        void invoker.then(({ invoke }) => invoke("ssh_resize", { id, cols, rows }));
      }, RESIZE_DEBOUNCE_MS);
    };

    const terminal = new TerminalEmulator(
      INITIAL_ROWS,
      INITIAL_COLS,
      TERMINAL_FOREGROUND,
      TERMINAL_BACKGROUND,
      send,
      resize,
    );
    emulator = terminal;

    const start = async () => {
      const { invoke } = await invoker;
      const { listen } = await import("@tauri-apps/api/event");

      unlisten.push(
        await listen<string>(`ssh://data/${id}`, (event) => {
          if (status === "connecting") status = "connected";
          terminal.write(Uint8Array.from(atob(event.payload), (char) => char.charCodeAt(0)));
        }),
      );
      unlisten.push(
        await listen(`ssh://closed/${id}`, () => {
          status = "closed";
        }),
      );
      disconnect = () => void invoke("ssh_close", { id });

      try {
        const detected = await invoke<string | null>("ssh_connect", {
          id,
          profile: {
            host: profile.host,
            port: profile.port,
            user: profile.user,
            password: profile.password,
          },
          cols: terminal.cols,
          rows: terminal.rows,
        });
        if (detected && detected !== profile.os) sshStore.upsert({ ...profile, os: detected });
      } catch (reason) {
        error = String(reason);
        status = "failed";
        return;
      }
      if (disposed) {
        void invoke("ssh_close", { id });
        return;
      }
      ready = true;
      resize(terminal.cols, terminal.rows);
    };

    void start();

    return () => {
      disposed = true;
      ready = false;
      disconnect = null;
      unlisten.forEach((stop) => stop());
      void invoker.then(({ invoke }) => invoke("ssh_close", { id }));
      emulator = null;
    };
  });
</script>

{#snippet sessionStatus()}
  {#if status === "connecting"}
    <LoadingIndicator size={8} fill />
  {:else}
    <StatusDot class={status === "connected" ? "bg-green" : "bg-red"} box={8} />
  {/if}
{/snippet}

{#snippet sessionActions()}
  <TooltipIconButton
    label={t("SSH_DISCONNECT")}
    onclick={() => {
      disconnect?.();
      onClose();
    }}
  >
    <X size={20} />
  </TooltipIconButton>
{/snippet}

<div class="flex h-full flex-col">
  <AppTopBar
    title={profile.name || profile.host}
    subtitle={isTauri ? statusLabel : null}
    subtitleLeading={isTauri ? sessionStatus : undefined}
    actions={isTauri ? sessionActions : undefined}
  >
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={onClose}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
  </AppTopBar>

  {#if !isTauri}
    <EmptyState text={t("WEB_UNAVAILABLE")} class="flex-1" />
  {:else if error}
    <EmptyState text={t("SSH_FAILED", error)} class="flex-1" />
  {:else}
    <div class="min-h-0 flex-1" style="background: {TERMINAL_BACKGROUND}">
      {#if emulator}
        <TerminalView
          bind:this={view}
          emulator={emulator}
          background={TERMINAL_BACKGROUND}
          foreground={TERMINAL_FOREGROUND}
        />
      {/if}
    </div>
    <div class="flex shrink-0 items-center gap-2 border-t border-outline-variant bg-surface px-3 py-2">
      <div use:hscrollbar={{ touchIndicator: false, wheel: true }} class="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
        {#each SOFT_KEYS as key (key.title)}
          <button
            type="button"
            title={key.title}
            aria-label={key.title}
            onclick={() => sendKey(key.bytes)}
            class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full px-3 text-label-md text-on-surface-variant transition-colors hover:bg-on-surface/8"
          >
            {#if key.icon}
              {@const Icon = key.icon}
              <Icon size={16} />
            {:else}
              {key.label}
            {/if}
          </button>
        {/each}
      </div>
      {#if isTouch}
        <TooltipIconButton
          label={t("KEYBOARD")}
          tooltip={false}
          class="size-8"
          onclick={() => view?.toggleKeyboard()}
        >
          <Keyboard />
        </TooltipIconButton>
      {/if}
    </div>
  {/if}
</div>
