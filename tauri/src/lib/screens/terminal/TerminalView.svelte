<script lang="ts">
  import type { TerminalCell, TerminalEmulator } from "./emulator.svelte";

  interface Props {
    emulator: TerminalEmulator;
    background: string;
    foreground: string;
  }

  const { emulator, background, foreground }: Props = $props();

  const CURSOR_BLINK_MS = 530;
  const FONT_SIZE = 13;
  const LINE_HEIGHT = 1.25;

  interface Run {
    text: string;
    fg: string;
    bg: string;
    bold: boolean;
  }

  let container = $state<HTMLDivElement | null>(null);
  let field = $state<HTMLTextAreaElement | null>(null);

  export function focus() {
    field?.focus();
  }
  let cellWidth = $state(8);
  let cursorOn = $state(true);

  const snapshot = $derived.by(() => {
    void emulator.frame;
    return emulator.snapshot();
  });

  const runsOf = (cells: TerminalCell[], cursorCol: number): Run[] => {
    let end = cells.length;
    while (end > 0) {
      const cell = cells[end - 1];
      if (end - 1 !== cursorCol && cell.char === " " && cell.bg === background) end--;
      else break;
    }
    const limit = Math.max(end, cursorCol >= 0 ? cursorCol + 1 : 0);
    const runs: Run[] = [];
    let index = 0;
    while (index < limit) {
      const cell = cells[index] ?? { char: " ", fg: foreground, bg: background, bold: false };
      let text = cell.char;
      let next = index + 1;
      while (next < limit) {
        const following = cells[next];
        if (!following || following.fg !== cell.fg || following.bg !== cell.bg || following.bold !== cell.bold) break;
        text += following.char;
        next++;
      }
      runs.push({ text, fg: cell.fg, bg: cell.bg, bold: cell.bold });
      index = next;
    }
    return runs;
  };

  const measure = () => {
    if (!container) return;
    const probe = document.createElement("span");
    probe.textContent = "M".repeat(10);
    probe.style.cssText = `position:absolute;visibility:hidden;font-family:var(--font-mono);font-size:${FONT_SIZE}px`;
    container.appendChild(probe);
    cellWidth = probe.getBoundingClientRect().width / 10;
    probe.remove();
    const lineHeight = FONT_SIZE * LINE_HEIGHT;
    const cols = Math.max(1, Math.floor(container.clientWidth / cellWidth));
    const rows = Math.max(1, Math.floor(container.clientHeight / lineHeight));
    emulator.resize(cols, rows);
  };

  const keyBytes = (event: KeyboardEvent): Uint8Array | null => {
    if (event.ctrlKey && !event.altKey && event.key.length === 1) {
      const letter = event.key.toLowerCase();
      if (letter >= "a" && letter <= "z") return new Uint8Array([letter.charCodeAt(0) - 96]);
    }
    switch (event.key) {
      case "Enter":
        return new Uint8Array([0x0d]);
      case "Backspace":
        return new Uint8Array([0x7f]);
      case "Tab":
        return new Uint8Array([0x09]);
      case "Escape":
        return new Uint8Array([0x1b]);
      case "ArrowUp":
        return new Uint8Array([0x1b, 0x5b, 0x41]);
      case "ArrowDown":
        return new Uint8Array([0x1b, 0x5b, 0x42]);
      case "ArrowRight":
        return new Uint8Array([0x1b, 0x5b, 0x43]);
      case "ArrowLeft":
        return new Uint8Array([0x1b, 0x5b, 0x44]);
      case "Home":
        return new Uint8Array([0x1b, 0x5b, 0x48]);
      case "End":
        return new Uint8Array([0x1b, 0x5b, 0x46]);
      case "PageUp":
        return new Uint8Array([0x1b, 0x5b, 0x35, 0x7e]);
      case "PageDown":
        return new Uint8Array([0x1b, 0x5b, 0x36, 0x7e]);
      case "Delete":
        return new Uint8Array([0x1b, 0x5b, 0x33, 0x7e]);
      default:
        return null;
    }
  };

  const selectionText = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return "";
    return container?.contains(selection.anchorNode) ? selection.toString() : "";
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
      const text = selectionText();
      if (text) {
        event.preventDefault();
        void navigator.clipboard.writeText(text);
      }
      return;
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "v") return;
    const bytes = keyBytes(event);
    if (bytes) {
      event.preventDefault();
      emulator.send(bytes);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key.length === 1) {
      event.preventDefault();
      emulator.sendText(event.key);
    }
  };

  const onpaste = (event: ClipboardEvent) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text");
    if (text) emulator.sendText(text.replace(/\r?\n/g, "\r"));
  };

  $effect(() => {
    measure();
    if (!container) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  });

  $effect(() => {
    void emulator.frame;
    cursorOn = true;
    const timer = setInterval(() => (cursorOn = !cursorOn), CURSOR_BLINK_MS);
    return () => clearInterval(timer);
  });

  $effect(() => {
    void snapshot;
    if (container) container.scrollTop = container.scrollHeight;
  });

  $effect(() => {
    field?.focus();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={container}
  class="selectable h-full overflow-y-auto p-1 font-mono outline-none"
  style="background: {background}; color: {foreground}; font-size: {FONT_SIZE}px; line-height: {LINE_HEIGHT}"
  role="application"
  aria-label="terminal"
  tabindex="-1"
  onclick={() => {
    if (!selectionText()) field?.focus();
  }}
>
  {#each snapshot.lines as cells, index (index)}
    {@const cursorCol =
      index === snapshot.cursorRow ? Math.min(snapshot.cursorCol, snapshot.columns - 1) : -1}
    <div class="relative whitespace-pre">
      {#each runsOf(cells, cursorCol) as run, runIndex (runIndex)}
        <span style="color: {run.fg}; background: {run.bg}; font-weight: {run.bold ? 700 : 400}">{run.text}</span>
      {/each}
      {#if cursorCol >= 0 && cursorOn}
        <span
          class="pointer-events-none absolute top-0 bottom-0 opacity-60"
          style="left: {cursorCol * cellWidth}px; width: {cellWidth}px; background: {foreground}"
        ></span>
      {/if}
    </div>
  {/each}
  <textarea
    bind:this={field}
    {onkeydown}
    {onpaste}
    aria-hidden="true"
    class="absolute size-px resize-none border-0 bg-transparent p-0 text-transparent opacity-0 outline-none"
  ></textarea>
</div>
