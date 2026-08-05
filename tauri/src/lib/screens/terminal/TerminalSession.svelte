<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { sshAddress, sshStore, type SshProfile } from "$lib/data/sshStore.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
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

  let error = $state<string | null>(null);
  let closed = $state(false);
  let emulator = $state<TerminalEmulator | null>(null);

  const themeColor = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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
      themeColor("--c-on-background") || "#ffffff",
      themeColor("--c-background") || "#000000",
      send,
      resize,
    );
    emulator = terminal;

    const start = async () => {
      const { invoke } = await invoker;
      const { listen } = await import("@tauri-apps/api/event");

      unlisten.push(
        await listen<string>(`ssh://data/${id}`, (event) => {
          terminal.write(Uint8Array.from(atob(event.payload), (char) => char.charCodeAt(0)));
        }),
      );
      unlisten.push(
        await listen(`ssh://closed/${id}`, () => {
          closed = true;
        }),
      );

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
      unlisten.forEach((stop) => stop());
      void invoker.then(({ invoke }) => invoke("ssh_close", { id }));
      emulator = null;
    };
  });
</script>

<div class="flex h-full flex-col">
  <AppTopBar title={profile.name || profile.host} subtitle={sshAddress(profile)}>
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
    <div class="relative min-h-0 flex-1">
      {#if emulator}
        <TerminalView
          emulator={emulator}
          background={themeColor("--c-background") || "#000000"}
          foreground={themeColor("--c-on-background") || "#ffffff"}
        />
      {/if}
      {#if closed}
        <p class="absolute inset-x-0 bottom-0 bg-surface px-4 py-1.5 text-body-sm text-on-surface-variant">
          {t("SSH_CLOSED")}
        </p>
      {/if}
    </div>
  {/if}
</div>
