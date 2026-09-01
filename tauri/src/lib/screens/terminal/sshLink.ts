import { sshStore, type SshProfile } from "$lib/data/sshStore.svelte";
import type { TerminalHooks, TerminalLink } from "$lib/data/terminalLink";

const RESIZE_DEBOUNCE_MS = 50;

export const sshLink = (profile: SshProfile, hooks: TerminalHooks, cols: number, rows: number): TerminalLink => {
  const id = crypto.randomUUID();
  const invoker = import("@tauri-apps/api/core");
  const unlisten: Array<() => void> = [];
  let ready = false;
  let disposed = false;
  let announced = false;
  let pending: [number, number] | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  const pushSize = (nextCols: number, nextRows: number) => {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      void invoker.then(({ invoke }) => invoke("ssh_resize", { id, cols: nextCols, rows: nextRows }));
    }, RESIZE_DEBOUNCE_MS);
  };

  const start = async () => {
    const { invoke } = await invoker;
    const { listen } = await import("@tauri-apps/api/event");

    unlisten.push(
      await listen<string>(`ssh://data/${id}`, (event) => {
        if (!announced) {
          announced = true;
          hooks.onStatus("connected");
        }
        hooks.onData(Uint8Array.from(atob(event.payload), (char) => char.charCodeAt(0)));
      }),
    );
    unlisten.push(await listen(`ssh://closed/${id}`, () => hooks.onStatus("closed")));

    try {
      const detected = await invoke<string | null>("ssh_connect", {
        id,
        profile: { host: profile.host, port: profile.port, user: profile.user, password: profile.password },
        cols,
        rows,
      });
      if (detected && detected !== profile.os) sshStore.upsert({ ...profile, os: detected });
    } catch {
      hooks.onStatus("failed");
      return;
    }
    if (disposed) {
      void invoke("ssh_close", { id });
      return;
    }
    ready = true;
    const [nextCols, nextRows] = pending ?? [cols, rows];
    pending = null;
    pushSize(nextCols, nextRows);
  };

  void start();

  return {
    send: (data) => {
      if (ready) void invoker.then(({ invoke }) => invoke("ssh_send", { id, data: Array.from(data) }));
    },
    resize: (nextCols, nextRows) => {
      if (!ready) {
        pending = [nextCols, nextRows];
        return;
      }
      pushSize(nextCols, nextRows);
    },
    close: () => {
      disposed = true;
      ready = false;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      unlisten.forEach((stop) => stop());
      void invoker.then(({ invoke }) => invoke("ssh_close", { id }));
    },
  };
};
