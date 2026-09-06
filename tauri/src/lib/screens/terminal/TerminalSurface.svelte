<script lang="ts">
  import { FitAddon } from "@xterm/addon-fit";
  import { WebglAddon } from "@xterm/addon-webgl";
  import { Terminal } from "@xterm/xterm";
  import type { TerminalConnector, TerminalLink, TerminalStatus } from "$lib/data/terminalLink";
  import type { PtyInfo } from "$lib/services/terminalApi";
  import { FONT_SIZE, LINE_HEIGHT, TERMINAL_BACKGROUND, terminalTheme } from "./theme";
  import "@xterm/xterm/css/xterm.css";

  interface Props {
    connect: TerminalConnector;
    autofocus?: boolean;
    reserved?: string[];
    pty?: PtyInfo | null;
    onStatus?: (status: TerminalStatus) => void;
  }

  const { connect, autofocus = true, reserved = [], pty = null, onStatus }: Props = $props();

  const windowsPty = $derived(
    pty && pty.backend !== "pty"
      ? { backend: pty.backend, ...(pty.build === null ? {} : { buildNumber: pty.build }) }
      : null,
  );

  const SCROLLBACK = 5000;
  const FIT_SETTLE_MS = 250;

  let host = $state<HTMLDivElement | null>(null);
  let terminal: Terminal | null = null;
  let link: TerminalLink | null = null;
  let pendingFocus = false;

  const encoder = new TextEncoder();

  export function focus() {
    pendingFocus = terminal === null;
    terminal?.focus();
  }

  export function toggleKeyboard() {
    if (document.activeElement?.classList.contains("xterm-helper-textarea")) terminal?.blur();
    else terminal?.focus();
  }

  export function sendKey(bytes: number[]) {
    link?.send(new Uint8Array(bytes));
    terminal?.focus();
  }

  export function disconnect() {
    link?.close();
  }

  $effect(() => {
    const container = host;
    if (!container) return;

    const term = new Terminal({
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim(),
      fontSize: FONT_SIZE,
      lineHeight: LINE_HEIGHT,
      cursorBlink: true,
      scrollback: SCROLLBACK,
      allowProposedApi: true,
      theme: terminalTheme(),
      ...(windowsPty ? { windowsPty } : {}),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);

    let webgl: WebglAddon | null = new WebglAddon();
    try {
      term.loadAddon(webgl);
      webgl.onContextLoss(() => {
        webgl?.dispose();
        webgl = null;
      });
    } catch {
      webgl?.dispose();
      webgl = null;
    }

    fit.fit();
    terminal = term;

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      if (event.ctrlKey && !event.altKey && reserved.includes(event.key.toLowerCase())) return false;
      return !(event.ctrlKey && event.key === "Tab");
    });

    onStatus?.("connecting");
    const current = connect(
      {
        onData: (bytes) => term.write(bytes),
        onStatus: (status) => onStatus?.(status),
      },
      term.cols,
      term.rows,
    );
    link = current;

    const typed = term.onData((data) => current.send(encoder.encode(data)));
    const binary = term.onBinary((data) =>
      current.send(Uint8Array.from(data, (char) => char.charCodeAt(0) & 0xff)),
    );
    const resized = term.onResize(({ cols, rows }) => current.resize(cols, rows));

    const screen = container.querySelector<HTMLElement>(".xterm-screen");
    let pointer: number | null = null;
    let lastY = 0;
    let carry = 0;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        pointer = null;
        return;
      }
      pointer = event.touches[0].identifier;
      lastY = event.touches[0].clientY;
      carry = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = Array.from(event.touches).find((item) => item.identifier === pointer);
      const cell = screen && term.rows ? screen.clientHeight / term.rows : 0;
      if (!touch || cell <= 0) return;
      carry += lastY - touch.clientY;
      lastY = touch.clientY;
      const lines = Math.trunc(carry / cell);
      if (!lines) return;
      carry -= lines * cell;
      term.scrollLines(lines);
    };

    const onTouchEnd = () => {
      pointer = null;
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });

    let settle: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (settle !== null) clearTimeout(settle);
      settle = setTimeout(() => {
        settle = null;
        if (container.clientWidth > 0 && container.clientHeight > 0) fit.fit();
      }, FIT_SETTLE_MS);
    });
    observer.observe(container);

    if (autofocus || pendingFocus) {
      pendingFocus = false;
      term.focus();
    }

    return () => {
      if (settle !== null) clearTimeout(settle);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      observer.disconnect();
      typed.dispose();
      binary.dispose();
      resized.dispose();
      webgl?.dispose();
      current.close();
      term.dispose();
      terminal = null;
      link = null;
    };
  });
</script>

<div class="h-full w-full p-2" style="background: {TERMINAL_BACKGROUND}">
  <div bind:this={host} class="h-full w-full touch-none"></div>
</div>
