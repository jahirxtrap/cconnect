<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import SquareMousePointer from "@lucide/svelte/icons/square-mouse-pointer";
  import type { Snippet } from "svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import BrowserDeviceMenu from "./BrowserDeviceMenu.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isEditing } from "$lib/data/paneFocus.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import TabStrip from "$lib/screens/chat/TabStrip.svelte";
  import {
    browserLink,
    type BrowserLink,
    type BrowserState,
    type BrowserViewport,
  } from "$lib/services/browserSocket";
  import { copyText, pasteText } from "$lib/platform/clipboard";
  import { shortcuts, type ShortcutScope } from "$lib/platform/shortcuts.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    trailing?: Snippet;
    focused?: boolean;
  }

  const { trailing, focused = false }: Props = $props();

  const RESIZE_DEBOUNCE_MS = 150;
  const WHEEL_LINE_PX = 40;
  const MIN_WIDTH = 320;
  const MIN_HEIGHT = 240;
  const MAX_SCALE = 3;
  const BUTTONS = ["left", "middle", "right", "back", "forward"];
  const SCOPES: ShortcutScope[] = ["browser", "global"];
  const ALT = 1;
  const CTRL = 2;
  const META = 4;
  const SHIFT = 8;

  const pane = inPane();

  let surface = $state<HTMLDivElement | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let addressBox = $state<HTMLElement | null>(null);
  let connected = $state(false);
  let ready = $state(false);
  let cursor = $state("auto");
  let dragging = $state(false);
  let page = $state<BrowserState>({
    running: false,
    url: "",
    title: "",
    canGoBack: false,
    canGoForward: false,
    activeTab: "",
    tabs: [],
    pageWidth: 0,
    pageHeight: 0,
    device: "",
    picking: false,
  });
  let address = $state("");
  let typing = $state(false);

  let link: BrowserLink | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  const viewport = (): BrowserViewport => ({
    width: Math.max(MIN_WIDTH, Math.round(surface?.clientWidth ?? 0)),
    height: Math.max(MIN_HEIGHT, Math.round(surface?.clientHeight ?? 0)),
    scale: Math.min(MAX_SCALE, Math.max(1, window.devicePixelRatio || 1)),
  });

  const paint = (bitmap: ImageBitmap) => {
    const node = canvas;
    if (!node) {
      bitmap.close();
      return;
    }
    ready = true;
    if (node.width !== bitmap.width || node.height !== bitmap.height) {
      node.width = bitmap.width;
      node.height = bitmap.height;
      context = node.getContext("2d");
    }
    context ??= node.getContext("2d");
    context?.drawImage(bitmap, 0, 0);
    bitmap.close();
  };

  $effect(() => {
    if (!surface) return;
    const created = browserLink(
      {
        onFrame: paint,
        onState: (next) => {
          page = dragging ? { ...next, tabs: page.tabs } : next;
          if (!typing) address = next.url;
        },
        onConnected: (value) => {
          connected = value;
          if (!value) ready = false;
        },
        onCursor: (shape) => (cursor = shape),
        onClipboard: (text) => {
          if (text) void copyText(text);
        },
        onPicked: (pick) => {
          const target = panes.focusedTab;
          if (!target) return;
          const chat = tabs.stateFor(target);
          const block = `${page.url}\n\`${pick.selector}\`\n\n\`\`\`html\n${pick.html}\n\`\`\``;
          chat.draft = chat.draft ? `${chat.draft}\n\n${block}` : block;
        },
      },
      viewport,
    );
    link = created;
    return () => {
      created.close();
      link = null;
    };
  });

  $effect(() => {
    if (page.activeTab || !canvas) return;
    context ??= canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  });

  $effect(() => {
    const node = surface;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => link?.resize(viewport()), RESIZE_DEBOUNCE_MS);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (resizeTimer !== null) clearTimeout(resizeTimer);
    };
  });

  const modifiers = (event: MouseEvent | KeyboardEvent) =>
    (event.altKey ? ALT : 0) |
    (event.ctrlKey ? CTRL : 0) |
    (event.metaKey ? META : 0) |
    (event.shiftKey ? SHIFT : 0);

  const shown = () => {
    const width = canvas?.clientWidth ?? 0;
    return width > 0 && page.pageWidth > 0 ? width / page.pageWidth : 1;
  };

  const at = (event: { offsetX: number; offsetY: number }) => {
    const scale = shown();
    return { x: event.offsetX / scale, y: event.offsetY / scale };
  };

  const pointer = (event: PointerEvent, kind: string) => {
    const spot = at(event);
    link?.mouse({
      event: kind,
      x: spot.x,
      y: spot.y,
      button: kind === "mouseMoved" && event.buttons === 0 ? "none" : (BUTTONS[event.button] ?? "left"),
      buttons: event.buttons,
      clickCount: kind === "mouseMoved" ? 0 : event.detail || 1,
      modifiers: modifiers(event),
    });
  };

  const onwheel = (event: WheelEvent) => {
    event.preventDefault();
    const lines =
      event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? (surface?.clientHeight ?? 1) : 1;
    const factor = lines / shown();
    const spot = at(event);
    link?.mouse({
      event: "mouseWheel",
      x: spot.x,
      y: spot.y,
      button: "none",
      buttons: 0,
      clickCount: 0,
      deltaX: event.deltaX * factor,
      deltaY: event.deltaY * factor,
      modifiers: modifiers(event),
    });
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      canvas?.blur();
      return;
    }
    if (shortcuts.handle(event, SCOPES)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey;
    link?.key({
      event: printable ? "keyDown" : "rawKeyDown",
      key: event.key,
      code: event.code,
      keyCode: event.keyCode,
      text: printable ? event.key : "",
      modifiers: modifiers(event),
    });
  };

  const onkeyup = (event: KeyboardEvent) => {
    if (event.key === "Escape") return;
    event.preventDefault();
    link?.key({
      event: "keyUp",
      key: event.key,
      code: event.code,
      keyCode: event.keyCode,
      modifiers: modifiers(event),
    });
  };

  const cycle = (step: number) => {
    const list = page.tabs;
    if (list.length < 2) return;
    const at = list.findIndex((tab) => tab.id === page.activeTab);
    const next = list[(at + step + list.length) % list.length];
    if (next) link?.switchTab(next.id);
  };

  useShortcut("browser.tab.new", () => link?.newTab());
  useShortcut("browser.tab.close", () => {
    if (page.activeTab) link?.closeTab(page.activeTab);
  });
  useShortcut("browser.tab.next", () => cycle(1));
  useShortcut("browser.tab.previous", () => cycle(-1));
  useShortcut("browser.reload", () => link?.reload());
  useShortcut("browser.back", () => link?.back());
  useShortcut("browser.forward", () => link?.forward());
  const selectAddress = () => addressBox?.querySelector("input")?.select();

  useShortcut("browser.address", () => {
    addressBox?.querySelector("input")?.focus();
    selectAddress();
  });
  useShortcut("browser.pick", () => link?.pick(!page.picking));
  useShortcut("browser.copy", () => {
    if (isEditing()) return false;
    link?.clip(false);
  });
  useShortcut("browser.cut", () => {
    if (isEditing()) return false;
    link?.clip(true);
  });
  useShortcut("browser.paste", () => {
    if (isEditing()) return false;
    void pasteText().then((text) => text && link?.text(text));
  });

  const submit = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    typing = false;
    link?.navigate(address);
    canvas?.focus();
  };
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <TabStrip
    items={page.tabs.map((tab) => ({ id: tab.id, title: tab.title || tab.url }))}
    activeId={page.activeTab || null}
    onSelect={(id) => link?.switchTab(id)}
    onNew={() => link?.newTab()}
    newShortcut="browser.tab.new"
    onClose={(id) => link?.closeTab(id)}
    onMove={(id, index) => {
      dragging = true;
      const from = page.tabs.findIndex((tab) => tab.id === id);
      if (from < 0 || from === index) return;
      const next = [...page.tabs];
      next.splice(index, 0, ...next.splice(from, 1));
      page.tabs = next;
    }}
    onDrop={() => {
      dragging = false;
      link?.reorder(page.tabs.map((tab) => tab.id));
    }}
    emptyTitle={t("NEW_TAB")}
    newLabel={t("NEW_TAB")}
    dot={false}
    {focused}
    {trailing}
  />

  <div class="flex shrink-0 items-center gap-1 border-b border-outline-variant px-2 py-1.5">
    <TooltipIconButton
      label={t("BACK")}
      shortcut="browser.back"
      enabled={page.canGoBack}
      class="size-8"
      onclick={() => link?.back()}
    >
      <ArrowLeft size={18} />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("FORWARD")}
      shortcut="browser.forward"
      enabled={page.canGoForward}
      class="size-8"
      onclick={() => link?.forward()}
    >
      <ArrowRight size={18} />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("REFRESH")}
      shortcut="browser.reload"
      class="size-8"
      onclick={() => link?.reload()}
    >
      <RotateCw size={18} />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("BROWSER_PICK")}
      shortcut="browser.pick"
      class={page.picking ? "size-8 text-accent" : "size-8"}
      onclick={() => link?.pick(!page.picking)}
    >
      <SquareMousePointer size={18} />
    </TooltipIconButton>
    <BrowserDeviceMenu device={page.device} onSelect={(name) => link?.device(name)} />
    <div
      bind:this={addressBox}
      class="min-w-0 flex-1"
      onfocusin={selectAddress}
      onfocusout={() => {
        typing = false;
        address = page.url;
      }}
    >
      <InputField
        value={address}
        oninput={(next) => {
          address = next;
          typing = true;
        }}
        onkeydown={submit}
        onClear={() => (address = "")}
        placeholder={t("BROWSER_ADDRESS")}
        singleLine
      />
    </div>
  </div>

  <div
    bind:this={surface}
    class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-surface-variant"
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <canvas
      bind:this={canvas}
      tabindex="0"
      class="max-h-full max-w-full bg-surface outline-none"
      style="cursor: {page.picking ? 'crosshair' : cursor}"
      onpointerdown={(event) => {
        canvas?.focus();
        pointer(event, "mousePressed");
      }}
      onpointerup={(event) => pointer(event, "mouseReleased")}
      onpointermove={(event) => pointer(event, "mouseMoved")}
      oncontextmenu={(event) => event.preventDefault()}
      {onwheel}
      {onkeydown}
      {onkeyup}
    ></canvas>
    {#if !ready && !connected}
      <EmptyState
        text={pane && serverStatus.unavailable ? t("SERVER_UNAVAILABLE") : t("CONNECTION_ERROR")}
        class="absolute inset-0 bg-surface"
      />
    {:else if !ready}
      <CenteredProgress class="absolute inset-0 bg-surface" />
    {/if}
  </div>
</div>
