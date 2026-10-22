<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import ShieldOff from "@lucide/svelte/icons/shield-off";
  import SquareMousePointer from "@lucide/svelte/icons/square-mouse-pointer";
  import type { Snippet } from "svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import BrowserDeviceMenu from "./BrowserDeviceMenu.svelte";
  import BrowserSideSwitch from "./BrowserSideSwitch.svelte";
  import BrowserTabIcon from "./BrowserTabIcon.svelte";
  import { BrowserLayer, coverOf } from "./browserLayer";
  import type { BrowserEntry, BrowserSide } from "./browserTabs";
  import {
    deviceBrowser,
    devicePresets,
    nativePick,
    type DeviceBounds,
    type DevicePick,
  } from "./deviceBrowser.svelte";
  import { deviceBrowsing } from "./deviceEngine";
  import type { ElementSource } from "$lib/data/pickedElements";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { isEditing } from "$lib/data/paneFocus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { isDesktop } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { store } from "$lib/platform/storage";
  import { inPane, paneRole } from "$lib/screens/chat/paneSurface";
  import TabStrip from "$lib/screens/chat/TabStrip.svelte";
  import {
    browserLink,
    stopBrowser,
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
  const SIDE_KEY = "browser.side";
  const PAGE_KEYS = new Set(["browser.copy", "browser.cut", "browser.paste"]);
  const WATCHED = ["class", "data-state", "open", "hidden", "inert"];
  const OVERLAYS =
    "[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [role=tooltip], [data-dialog-overlay], [data-alert-dialog-overlay]";

  const pane = inPane();
  const role = paneRole();
  const layer = new BrowserLayer();

  let surface = $state<HTMLDivElement | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let addressBox = $state<HTMLElement | null>(null);
  let connected = $state(false);
  let ready = $state(false);
  let cursor = $state("auto");
  let side = $state<BrowserSide>(deviceBrowsing ? store.get<BrowserSide>(SIDE_KEY, "device") : "server");
  let launching = $state(false);
  let failed = $state(false);
  let page = $state<BrowserState>({
    available: true,
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
  let dragging = $state(false);
  let link = $state.raw<BrowserLink | null>(null);

  let context: CanvasRenderingContext2D | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  const onServer = $derived(side === "server");

  const titleOf = (title: string, url: string) => title || (url.startsWith("about:") ? "" : url) || t("NEW_TAB");

  const deviceEntries = $derived<BrowserEntry[]>(
    deviceBrowser.tabs.map((tab) => ({
      id: tab.id,
      title: titleOf(tab.title, tab.url),
      url: tab.url,
      favicon: tab.favicon,
    })),
  );
  const serverEntries = $derived<BrowserEntry[]>(
    page.running
      ? page.tabs.map((tab) => ({
          id: tab.id,
          title: titleOf(tab.title, tab.url),
          url: tab.url,
          favicon: tab.favicon ?? "",
        }))
      : [],
  );
  const entries = $derived(onServer ? serverEntries : deviceEntries);
  const activeId = $derived(onServer ? page.activeTab : deviceBrowser.activeId);
  const active = $derived(entries.find((entry) => entry.id === activeId) ?? null);
  const canGoBack = $derived(onServer ? page.canGoBack : !!deviceBrowser.active?.canGoBack);
  const canGoForward = $derived(onServer ? page.canGoForward : !!deviceBrowser.active?.canGoForward);
  const shownUrl = $derived(onServer ? page.url : (deviceBrowser.active?.url ?? ""));
  const picking = $derived(onServer ? page.picking : deviceBrowser.picking);

  const togglePick = () => (onServer ? link?.pick(!page.picking) : deviceBrowser.pick(!deviceBrowser.picking));

  $effect(() => {
    if (!layout.mobile) return;
    return navigation.intercept(
      () => {
        if (!canGoBack) return false;
        if (onServer) link?.back();
        else deviceBrowser.back();
        return true;
      },
      { system: true },
    );
  });

  const pickToChat = (source: ElementSource, url: string, title: string, pick: DevicePick) => {
    const target = panes.focusedTab;
    if (!target) return;
    tabs.stateFor(target).addElement({
      source,
      url,
      title,
      selector: pick.selector,
      width: pick.width,
      height: pick.height,
      html: pick.html,
    });
  };

  const setSide = (next: BrowserSide) => {
    if (next === side) return;
    if (onServer && page.picking) link?.pick(false);
    if (!onServer && deviceBrowser.picking) deviceBrowser.pick(false);
    side = next;
    typing = false;
    failed = false;
  };

  const openOnServer = (url: string) => {
    setSide("server");
    if (page.running) {
      link?.newTab(url);
      return;
    }
    launching = true;
    link?.watch(true);
    if (url) link?.navigate(url);
  };

  const openOnDevice = (url: string) => {
    deviceBrowser.newTab(url);
    setSide("device");
    if (!url) focusAddress();
  };

  const newTab = () => {
    if (onServer) openOnServer("");
    else openOnDevice("");
  };

  const closeTab = (id: string) => {
    if (!onServer) deviceBrowser.closeTab(id);
    else if (deviceBrowsing && serverEntries.length === 1) void stopBrowser();
    else link?.closeTab(id);
  };

  const navigate = (input: string) => {
    if (!onServer) {
      deviceBrowser.navigate(input);
      return;
    }
    if (page.running) link?.navigate(input);
    else openOnServer(input);
  };

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

  const receive = (next: BrowserState) => {
    page = dragging ? { ...next, tabs: page.tabs } : next;
    if (next.running) launching = false;
  };

  $effect(() => {
    if (!surface) return;
    const created = browserLink(
      {
        onFrame: paint,
        onState: receive,
        onConnected: (value) => {
          connected = value;
          if (!value) ready = false;
        },
        onCursor: (shape) => (cursor = shape),
        onClipboard: (text) => {
          if (text) void copyText(text);
        },
        onPicked: (pick) => pickToChat("server", page.url, page.title, pick),
        onError: () => {
          if (!launching) return;
          launching = false;
          failed = true;
        },
      },
      viewport,
      !deviceBrowsing,
    );
    link = created;
    return () => {
      created.close();
      link = null;
      ready = false;
      connected = false;
    };
  });

  $effect(() => {
    const wanted = !deviceBrowsing || (onServer && (page.running || launching));
    link?.watch(wanted);
    if (!wanted) ready = false;
  });

  $effect(() => {
    if (deviceBrowsing) store.set(SIDE_KEY, side);
  });

  $effect(() => {
    if (!deviceBrowsing) return;
    deviceBrowser.start();
    deviceBrowser.onPicked = (url, pick) => pickToChat("device", url, deviceBrowser.active?.title ?? "", pick);
    deviceBrowser.onKey = (keys) => shortcuts.run(shortcuts.idFor(keys, SCOPES));
    deviceBrowser.onFocus = () => {
      if (role && !layout.mobile) panes.focus(role);
    };
    return () => {
      deviceBrowser.onPicked = null;
      deviceBrowser.onKey = null;
      deviceBrowser.onFocus = null;
    };
  });

  $effect(() => {
    if (onServer || !isDesktop) return;
    void shortcuts.custom;
    deviceBrowser.keys(
      shortcuts
        .available(SCOPES)
        .filter((shortcut) => !PAGE_KEYS.has(shortcut.id))
        .map((shortcut) => shortcuts.keys(shortcut.id))
        .filter(Boolean),
    );
    return () => deviceBrowser.keys([]);
  });

  $effect(() => {
    if (!typing) address = shownUrl;
  });

  const covered = (area: DOMRect) =>
    [...document.querySelectorAll<HTMLElement>(OVERLAYS)].some((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.left < area.right && box.right > area.left && box.top < area.bottom && box.bottom > area.top;
    });

  const grabFocus = (node: HTMLElement) => {
    void deviceBrowser.release().then(() => node.focus());
  };

  const boundsOf = (area: DOMRect): DeviceBounds | null =>
    area.width < 1 || area.height < 1
      ? null
      : {
          x: Math.round(area.left),
          y: Math.round(area.top),
          width: Math.round(area.width),
          height: Math.round(area.height),
        };

  const animating = () =>
    document
      .getAnimations()
      .some((animation) => animation.playState === "running" && animation.effect?.getComputedTiming().iterations !== Infinity);

  $effect(() => {
    const node = surface;
    if (!node || onServer || !deviceBrowsing) return;
    let dirty = true;
    let aimed = false;
    let hole: DeviceBounds | null = null;
    let cover: DeviceBounds[] = [];
    const mark = () => (dirty = true);
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: WATCHED });
    window.addEventListener("resize", mark);
    document.addEventListener("scroll", mark, true);
    let frame = requestAnimationFrame(function follow() {
      const area = node.getBoundingClientRect();
      deviceBrowser.place(boundsOf(area), !layer.supported && covered(area));
      const shown = deviceBrowser.shown;
      const aiming = nativePick && deviceBrowser.picking;
      const moved = JSON.stringify(shown) !== JSON.stringify(hole) || aiming !== aimed;
      if (moved || dirty || animating()) {
        hole = shown;
        aimed = aiming;
        cover = !hole ? [] : aiming ? [hole] : coverOf(node, hole);
        dirty = false;
        layer.show(node, hole, cover);
      }
      frame = requestAnimationFrame(follow);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", mark);
      document.removeEventListener("scroll", mark, true);
      deviceBrowser.place(null);
      layer.clear();
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

  const selectTab = (id: string) => (onServer ? link?.switchTab(id) : deviceBrowser.switchTab(id));

  const cycle = (step: number) => {
    if (entries.length < 2) return;
    const from = entries.findIndex((entry) => entry === active);
    selectTab(entries[(from + step + entries.length) % entries.length].id);
  };

  useShortcut("browser.tab.new", newTab);
  useShortcut("browser.tab.close", () => {
    if (active) closeTab(active.id);
  });
  useShortcut("browser.tab.next", () => cycle(1));
  useShortcut("browser.tab.previous", () => cycle(-1));
  useShortcut("browser.reload", () => (onServer ? link?.reload() : deviceBrowser.reload()));
  useShortcut("browser.back", () => (onServer ? link?.back() : deviceBrowser.back()));
  useShortcut("browser.forward", () => (onServer ? link?.forward() : deviceBrowser.forward()));
  const selectAddress = () => addressBox?.querySelector("input")?.select();

  function focusAddress() {
    const input = addressBox?.querySelector("input");
    if (!input) return;
    const take = () => {
      input.focus();
      input.select();
    };
    if (onServer) take();
    else void deviceBrowser.release().then(take);
  }

  useShortcut("browser.address", focusAddress);
  useShortcut("browser.pick", togglePick);
  useShortcut(
    "browser.copy",
    () => {
      if (isEditing()) return false;
      link?.clip(false);
    },
    () => onServer,
  );
  useShortcut(
    "browser.cut",
    () => {
      if (isEditing()) return false;
      link?.clip(true);
    },
    () => onServer,
  );
  useShortcut(
    "browser.paste",
    () => {
      if (isEditing()) return false;
      void pasteText().then((text) => text && link?.text(text));
    },
    () => onServer,
  );

  const submit = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    typing = false;
    navigate(address);
    if (onServer) canvas?.focus();
    else deviceBrowser.focus();
  };
</script>

{#snippet tabIcon(id: string)}
  <BrowserTabIcon src={entries.find((item) => item.id === id)?.favicon ?? ""} />
{/snippet}

{#snippet sideSwitch()}
  <BrowserSideSwitch {side} onSelect={setSide} />
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
  <TabStrip
    items={entries.map((entry) => ({ id: entry.id, title: entry.title }))}
    activeId={active?.id ?? null}
    onSelect={selectTab}
    onNew={newTab}
    newShortcut="browser.tab.new"
    onClose={closeTab}
    onMove={(id, index) => {
      if (!onServer) {
        const ids = deviceBrowser.tabs.map((tab) => tab.id);
        const from = ids.indexOf(id);
        if (from < 0 || from === index) return;
        ids.splice(index, 0, ...ids.splice(from, 1));
        deviceBrowser.reorder(ids);
        return;
      }
      dragging = true;
      const from = page.tabs.findIndex((tab) => tab.id === id);
      if (from < 0 || from === index) return;
      const next = [...page.tabs];
      next.splice(index, 0, ...next.splice(from, 1));
      page.tabs = next;
    }}
    onDrop={() => {
      if (!onServer) return;
      dragging = false;
      link?.reorder(page.tabs.map((tab) => tab.id));
    }}
    emptyTitle={t("NEW_TAB")}
    newLabel={t("NEW_TAB")}
    dot={false}
    leading={tabIcon}
    lead={deviceBrowsing ? sideSwitch : undefined}
    {focused}
    {trailing}
  />

  <div class="flex shrink-0 items-center border-b border-outline-variant px-2 py-1.5">
    <TooltipIconButton
      label={t("BACK")}
      shortcut="browser.back"
      enabled={canGoBack}
      class="size-8"
      onclick={() => (onServer ? link?.back() : deviceBrowser.back())}
    >
      <ArrowLeft size={18} />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("FORWARD")}
      shortcut="browser.forward"
      enabled={canGoForward}
      class="size-8"
      onclick={() => (onServer ? link?.forward() : deviceBrowser.forward())}
    >
      <ArrowRight size={18} />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("REFRESH")}
      shortcut="browser.reload"
      class="size-8"
      onclick={() => (onServer ? link?.reload() : deviceBrowser.reload())}
    >
      <RotateCw size={18} />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("BROWSER_PICK")}
      shortcut="browser.pick"
      class={picking ? "size-8 text-accent" : "size-8"}
      onclick={togglePick}
    >
      <SquareMousePointer size={18} />
    </TooltipIconButton>
    {#if onServer || devicePresets}
      <BrowserDeviceMenu
        device={onServer ? page.device : deviceBrowser.device}
        onSelect={(name) => (onServer ? link?.device(name) : deviceBrowser.setDevice(name))}
      />
    {/if}
    {#if !onServer && deviceBrowsing && settings.browserShield.enabled}
      {@const host = deviceBrowser.hostOf(deviceBrowser.active?.url ?? "")}
      {@const exempt = !!host && settings.browserShield.allowed.includes(host)}
      {@const count = deviceBrowser.blocked[deviceBrowser.activeId] ?? 0}
      <TooltipIconButton
        label={exempt || !count ? t("BROWSER_SHIELD_HERE") : plural("BROWSER_SHIELD_COUNT", count)}
        enabled={!!host}
        class="size-8 {exempt ? '' : 'text-accent'}"
        onclick={() => void deviceBrowser.allowHere(!exempt)}
      >
        {#if exempt}
          <ShieldOff size={18} />
        {:else}
          <ShieldCheck size={18} />
        {/if}
      </TooltipIconButton>
    {/if}
    <div
      bind:this={addressBox}
      class="min-w-0 flex-1 pl-1"
      onfocusin={selectAddress}
      onfocusout={() => {
        typing = false;
        address = shownUrl;
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
      class="max-h-full max-w-full bg-surface outline-none {onServer ? '' : 'hidden'}"
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
    {#if !onServer}
      {#if !deviceBrowser.active?.url}
        <EmptyState text={t("BROWSER_ADDRESS")} class="absolute inset-0 bg-surface" />
      {:else if nativePick && deviceBrowser.picking}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          use:grabFocus
          tabindex="-1"
          class="absolute inset-0 cursor-crosshair outline-none"
          onpointermove={(event) => deviceBrowser.aim({ x: event.clientX, y: event.clientY })}
          onpointerdown={(event) => {
            event.preventDefault();
            void deviceBrowser.choose({ x: event.clientX, y: event.clientY });
          }}
          onwheel={(event) => {
            event.preventDefault();
            deviceBrowser.scroll({ x: event.clientX, y: event.clientY }, event.deltaX, event.deltaY);
          }}
          onkeydown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            deviceBrowser.pick(false);
          }}
        ></div>
      {/if}
    {:else if !ready && !connected}
      <EmptyState
        text={pane && serverStatus.unavailable ? t("SERVER_UNAVAILABLE") : t("CONNECTION_ERROR")}
        class="absolute inset-0 bg-surface"
      />
    {:else if !ready && failed}
      <EmptyState
        text={page.available ? t("BROWSER_FAILED") : t("BROWSER_MISSING")}
        class="absolute inset-0 bg-surface"
      />
    {:else if !ready && !page.running && !launching}
      <EmptyState
        text={!page.available ? t("BROWSER_MISSING") : deviceBrowsing ? t("BROWSER_ADDRESS") : t("BROWSER_FAILED")}
        class="absolute inset-0 bg-surface"
      />
    {:else if !ready}
      <CenteredProgress class="absolute inset-0 bg-surface" />
    {/if}
  </div>
</div>
