import { sshStore, type SshProfile } from "$lib/data/sshStore.svelte";
import type { TerminalHooks, TerminalLink } from "$lib/data/terminalLink";
import { t } from "$lib/i18n/index.svelte";

const RESIZE_DEBOUNCE_MS = 50;
const KEY_CHANGED = "hostkey_changed:";
const ENTER = "\r";
const ESCAPE = "\x1b";
const WARNING = "\x1b[33m";
const RESET = "\x1b[0m";

const changedKey = (error: unknown): string | null => {
  const message = String(error);
  return message.startsWith(KEY_CHANGED) ? message.slice(KEY_CHANGED.length) : null;
};

export const sshLink = (profile: SshProfile, hooks: TerminalHooks, cols: number, rows: number): TerminalLink => {
  const id = crypto.randomUUID();
  const invoker = import("@tauri-apps/api/core");
  const unlisten: Array<() => void> = [];
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let ready = false;
  let disposed = false;
  let announced = false;
  let pending: [number, number] | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let answer: ((trusted: boolean) => void) | null = null;

  const write = (text: string) => hooks.onData(encoder.encode(text));

  const trustNewKey = (fingerprint: string) =>
    new Promise<boolean>((resolve) => {
      write(`\r\n${WARNING}${t("SSH_KEY_CHANGED", profile.host, fingerprint)}${RESET}\r\n${t("SSH_KEY_TRUST")}\r\n`);
      answer = (trusted) => {
        answer = null;
        resolve(trusted);
      };
    });

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

    const connect = () =>
      invoke<string | null>("ssh_connect", {
        id,
        profile: { host: profile.host, port: profile.port, user: profile.user, password: profile.password },
        cols,
        rows,
      });

    let detected: string | null;
    try {
      detected = await connect();
    } catch (error) {
      const fingerprint = changedKey(error);
      if (fingerprint === null || !(await trustNewKey(fingerprint)) || disposed) {
        hooks.onStatus("failed");
        return;
      }
      try {
        await invoke("ssh_forget_host", { host: profile.host, port: profile.port });
        detected = await connect();
      } catch {
        hooks.onStatus("failed");
        return;
      }
    }
    if (detected && detected !== profile.os) sshStore.upsert({ ...profile, os: detected });
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
      if (answer) {
        const typed = decoder.decode(data);
        if (typed.includes(ENTER)) answer(true);
        else if (typed.includes(ESCAPE)) answer(false);
        return;
      }
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
      answer?.(false);
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      unlisten.forEach((stop) => stop());
      void invoker.then(({ invoke }) => invoke("ssh_close", { id }));
    },
  };
};
