<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Globe from "@lucide/svelte/icons/globe";
  import House from "@lucide/svelte/icons/house";
  import Lock from "@lucide/svelte/icons/lock";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Search from "@lucide/svelte/icons/search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import ShieldOff from "@lucide/svelte/icons/shield-off";
  import X from "@lucide/svelte/icons/x";
  import { Portal } from "bits-ui";
  import { navigation } from "$lib/app/navigation.svelte";
  import { screenFor } from "$lib/app/screens";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import BrowserClearDialog from "./BrowserClearDialog.svelte";
  import BrowserFavoriteDialog from "./BrowserFavoriteDialog.svelte";
  import BrowserHome from "./BrowserHome.svelte";
  import BrowserOptionsMenu from "./BrowserOptionsMenu.svelte";
  import BrowserSideSwitch from "./BrowserSideSwitch.svelte";
  import BrowserTabIcon from "./BrowserTabIcon.svelte";
  import { BrowserLayer, coverOf } from "./browserLayer";
  import type { BrowserEntry, BrowserSide } from "./browserTabs";
  import {
    androidBrowsing,
    captureName,
    deviceBrowser,
    nativePick,
    type DeviceBounds,
    type DevicePick,
  } from "./deviceBrowser.svelte";
  import { deviceBrowsing } from "./deviceEngine";
  import { joined } from "$lib/data/format";
  import { pendingRefresh } from "$lib/data/inflight";
  import type { ElementSource } from "$lib/data/pickedElements";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { isEditing } from "$lib/data/paneFocus.svelte";
  import { settings, type BrowserFavorite } from "$lib/data/settings.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { isDesktop, isTouch, openExternal } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { store } from "$lib/platform/storage";
  import { paneRole } from "$lib/screens/chat/paneSurface";
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
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import { keepFocus } from "$lib/ui/keepFocus";
  import { PullState } from "$lib/ui/pull.svelte";
  import PullIndicator from "$lib/ui/PullIndicator.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    focused?: boolean;
  }

  const { focused = false }: Props = $props();

  const BROWSER_ICON = screenFor("browser").icon;
  const SITE_ICON_SIZE = 14;
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

  const blank = (url: string) => !url || url.startsWith("about:");

  const titleOf = (title: string, url: string) => title || (blank(url) ? "" : url) || t("NEW_TAB");

  const entryOf = (id: string, title: string, url: string, favicon: string, home: boolean): BrowserEntry =>
    home ? { id, title: t("NEW_TAB"), url, favicon: "" } : { id, title: titleOf(title, url), url, favicon };

  const DRAFT_TAB = "draft";

  let serverHome = $state(false);
  let serverDraft = $state(false);
  const deviceEntries = $derived<BrowserEntry[]>(
    deviceBrowser.tabs.map((tab) => entryOf(tab.id, tab.title, tab.url, tab.favicon, tab.home)),
  );
  const serverEntries = $derived<BrowserEntry[]>(
    page.running
      ? page.tabs.map((tab) =>
          entryOf(
            tab.id,
            tab.title,
            tab.url,
            tab.favicon ?? "",
            (serverHome && tab.id === page.activeTab) || blank(tab.url),
          ),
        )
      : serverDraft
        ? [entryOf(DRAFT_TAB, "", "", "", true)]
        : [],
  );
  const entries = $derived(onServer ? serverEntries : deviceEntries);
  const activeId = $derived(
    onServer ? (page.running || !serverDraft ? page.activeTab : DRAFT_TAB) : deviceBrowser.activeId,
  );
  const active = $derived(entries.find((entry) => entry.id === activeId) ?? null);
  const serverAtHome = $derived(
    serverHome || (page.running ? blank(page.url) : !ready && !launching && page.available),
  );
  const atHome = $derived(onServer ? serverAtHome : deviceBrowser.atHome);
  const canGoBack = $derived(
    onServer
      ? page.canGoBack || (serverHome && page.running)
      : !!deviceBrowser.active?.canGoBack || (atHome && !!deviceBrowser.active?.url),
  );
  const canGoForward = $derived(onServer ? page.canGoForward : !!deviceBrowser.active?.canGoForward);
  const pageUrl = $derived(onServer ? page.url : (deviceBrowser.active?.url ?? ""));
  const shownUrl = $derived(atHome ? "" : pageUrl);
  const SiteIcon = $derived(!shownUrl ? Search : shownUrl.startsWith("https:") ? Lock : Globe);
  const favorites = $derived(settings.browserFavorites);
  const favorite = $derived(!!shownUrl && favorites.some((item) => item.url === shownUrl));

  const nameOf = (item: BrowserFavorite) => item.title || deviceBrowser.hostOf(item.url) || item.url;

  const toggleFavorite = () => {
    if (!shownUrl) return;
    if (favorite) settings.browserFavorites = favorites.filter((item) => item.url !== shownUrl);
    else favoriting = { url: shownUrl, title: active?.title ?? "" };
  };

  const iconOf = (url: string) => {
    if (url === shownUrl && active?.favicon) return active.favicon;
    return URL.canParse(url) ? `${new URL(url).origin}/favicon.ico` : "";
  };

  const addFavorite = (url: string, title: string) => {
    settings.browserFavorites = [...favorites.filter((item) => item.url !== url), { url, title, icon: iconOf(url) }];
    favoriting = null;
  };

  const editFavorite = (target: BrowserFavorite, url: string, title: string) => {
    settings.browserFavorites = favorites.flatMap((item) =>
      item.url === target.url
        ? [{ url, title, icon: url === target.url ? item.icon : iconOf(url) }]
        : item.url === url
          ? []
          : [item],
    );
  };

  $effect(() => {
    const icon = active?.favicon;
    const url = shownUrl;
    if (!icon || !url || !favorites.some((item) => item.url === url && item.icon !== icon)) return;
    settings.browserFavorites = favorites.map((item) => (item.url === url ? { ...item, icon } : item));
  });

  const removeFavorite = (target: BrowserFavorite) => {
    settings.browserFavorites = favorites.filter((item) => item.url !== target.url);
  };

  const goHome = () => {
    if (onServer) serverHome = true;
    else deviceBrowser.goHome();
  };

  const goBack = () => {
    if (onServer && serverHome) serverHome = false;
    else if (onServer) link?.back();
    else deviceBrowser.back();
  };
  const picking = $derived(onServer ? page.picking : deviceBrowser.picking);
  const zoomable = $derived(!onServer && deviceBrowser.zoomable);
  const shielded = $derived(!onServer && !atHome && deviceBrowsing && settings.browserShield.enabled);

  const host = $derived(deviceBrowser.hostOf(shownUrl));

  let clearing = $state<{ site: string | null } | null>(null);
  let favoriting = $state<{ url: string; title: string } | null>(null);
  let pullRefreshing = $state(false);
  let finishPull = () => {};

  const pull = new PullState();

  const serverCapture = () =>
    new Promise<File | null>((done) => {
      if (!canvas) return done(null);
      canvas.toBlob(
        (blob) => done(blob ? new File([blob], captureName(active?.title ?? ""), { type: "image/png" }) : null),
        "image/png",
      );
    });

  const capture = async () => {
    const target = panes.focusedTab;
    if (!target) return;
    const file = onServer ? await serverCapture() : await deviceBrowser.capture();
    if (file) tabs.stateFor(target).addAttachments([file]);
  };

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
    failed = false;
    if (!url) {
      serverDraft = true;
      return;
    }
    launching = true;
    link?.watch(true);
    link?.navigate(url);
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
    else if (id === DRAFT_TAB) serverDraft = false;
    else if (serverEntries.length === 1) void stopBrowser();
    else link?.closeTab(id);
  };

  const navigate = (input: string) => {
    serverHome = false;
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
    if (!next.running) return;
    launching = false;
    serverDraft = false;
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
    const wanted = onServer && (page.running || launching);
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
    deviceBrowser.onKey = (keys) => shortcuts.dispatch(keys, SCOPES);
    deviceBrowser.onFocus = () => {
      if (role && !layout.mobile) panes.focus(role);
    };
    deviceBrowser.onPull = (distance, done) => {
      if (!done) {
        pull.drag(distance);
        return;
      }
      if (!pull.release(distance)) return;
      const pending = pendingRefresh();
      finishPull = pending.finish;
      pullRefreshing = true;
      deviceBrowser.reload();
      void pending.held.then(() => (pullRefreshing = false));
    };
    return () => {
      deviceBrowser.onPicked = null;
      deviceBrowser.onKey = null;
      deviceBrowser.onFocus = null;
      deviceBrowser.onPull = null;
    };
  });

  $effect(() => {
    if (pullRefreshing && !deviceBrowser.active?.loading) finishPull();
  });

  $effect(() => {
    if (pull.dragging) return;
    pull.settle(pullRefreshing ? 1 : 0);
  });

  $effect(() => () => pull.dispose());

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
      const visible = getComputedStyle(node).visibility !== "hidden";
      deviceBrowser.place(visible ? boundsOf(area) : null, !layer.supported && covered(area));
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

  const selectTab = (id: string) => {
    if (!onServer) {
      deviceBrowser.switchTab(id);
      return;
    }
    if (id === DRAFT_TAB) return;
    serverHome = false;
    link?.switchTab(id);
  };

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
  const reload = () => {
    if (atHome) return;
    if (onServer) link?.reload();
    else deviceBrowser.reload();
  };

  useShortcut("browser.reload", reload);
  useShortcut("browser.back", goBack);
  useShortcut("browser.forward", () => (onServer ? link?.forward() : deviceBrowser.forward()));
  const selectAddress = (event: FocusEvent) => {
    if (event.target instanceof HTMLInputElement) event.target.select();
  };

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
  useShortcut("browser.zoom.in", () => deviceBrowser.zoomBy(1), () => !onServer && deviceBrowser.zoomable);
  useShortcut("browser.zoom.out", () => deviceBrowser.zoomBy(-1), () => !onServer && deviceBrowser.zoomable);
  useShortcut("browser.zoom.reset", () => deviceBrowser.resetZoom(), () => !onServer && deviceBrowser.zoomable);
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

{#snippet home()}
  <BrowserHome
    {favorites}
    {nameOf}
    onSearch={navigate}
    onAdd={() => (favoriting = { url: "", title: "" })}
    onEdit={editFavorite}
    onRemove={removeFavorite}
  />
{/snippet}

{#snippet addressTools()}
  {#if address}
    <span use:keepFocus class="hidden group-focus-within/address:flex">
      <TooltipIconButton label={t("CANCEL")} tooltip={false} class="size-6" onclick={() => (address = "")}>
        <X />
      </TooltipIconButton>
    </span>
  {/if}
  {#if shielded}
    {@const exempt = !!host && settings.browserShield.allowed.includes(host)}
    {@const count = deviceBrowser.blocked[deviceBrowser.activeId] ?? 0}
    <span use:keepFocus class="flex">
      <TooltipIconButton
        label={exempt || !count ? t("BROWSER_SHIELD_HERE") : joined(t("BROWSER_SHIELD_HERE"), plural("BROWSER_SHIELD_COUNT", count))}
        enabled={!!host}
        active={!exempt}
        class="size-6"
        onclick={() => void deviceBrowser.allowHere(!exempt)}
      >
        {#if exempt}
          <ShieldOff />
        {:else}
          <ShieldCheck />
        {/if}
      </TooltipIconButton>
    </span>
  {/if}
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
    sub
    leading={tabIcon}
    lead={deviceBrowsing ? sideSwitch : undefined}
    {focused}
  />

  <div class="flex shrink-0 items-center px-2 pb-2">
    <TooltipIconButton
      label={t("BACK")}
      shortcut="browser.back"
      enabled={canGoBack}
      class="size-7"
      onclick={goBack}
    >
      <ArrowLeft />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("FORWARD")}
      shortcut="browser.forward"
      enabled={canGoForward}
      class="size-7"
      onclick={() => (onServer ? link?.forward() : deviceBrowser.forward())}
    >
      <ArrowRight />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("REFRESH")}
      shortcut="browser.reload"
      enabled={!atHome}
      class="size-7"
      onclick={reload}
    >
      <RotateCw />
    </TooltipIconButton>
    <TooltipIconButton label={t("BROWSER_HOME")} enabled={!atHome} class="size-7" onclick={goHome}>
      <House />
    </TooltipIconButton>
    <div
      bind:this={addressBox}
      class="group/address mx-1 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md bg-surface-variant pl-2.5 ring-1 ring-transparent transition-shadow ring-inset focus-within:ring-accent {shielded
        ? 'pr-1'
        : address
          ? 'pr-2.5 focus-within:pr-1'
          : 'pr-2.5'}"
      onfocusin={selectAddress}
      onfocusout={() => {
        typing = false;
        address = shownUrl;
        addressBox?.querySelector("input")?.setSelectionRange(0, 0);
      }}
    >
      <SiteIcon size={SITE_ICON_SIZE} class="shrink-0 {shownUrl ? 'text-on-surface-variant' : 'text-faint'}" />
      <input
        type="text"
        inputmode="url"
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        enterkeyhint="go"
        value={address}
        placeholder={t("BROWSER_ADDRESS")}
        aria-label={t("BROWSER_ADDRESS")}
        oninput={(event) => {
          address = event.currentTarget.value;
          typing = true;
        }}
        onkeydown={submit}
        class="min-w-0 flex-1 bg-transparent text-body-sm text-on-surface-variant caret-accent outline-none placeholder:text-faint focus:text-on-surface"
      />
      {@render addressTools()}
    </div>
    <BrowserOptionsMenu
      url={shownUrl}
      {favorite}
      onFavorite={toggleFavorite}
      device={onServer ? page.device : deviceBrowser.device}
      native={!onServer && androidBrowsing}
      onDevice={(name) => (onServer ? link?.device(name) : deviceBrowser.setDevice(name))}
      zoom={zoomable ? deviceBrowser.zoom : null}
      onZoom={(step) => deviceBrowser.zoomBy(step)}
      onZoomReset={() => deviceBrowser.resetZoom()}
      {picking}
      onPick={isTouch ? null : togglePick}
      onCapture={() => void capture()}
      onOpen={() => openExternal(shownUrl)}
      onCopy={() => void copyText(shownUrl)}
      onClearSite={onServer || !host ? null : () => (clearing = { site: host })}
      onClearAll={onServer ? null : () => (clearing = { site: null })}
    />
  </div>

  <div
    bind:this={surface}
    class="relative mx-2 mb-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-panel bg-background"
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <canvas
      bind:this={canvas}
      tabindex="0"
      class="max-h-full max-w-full bg-background outline-none {onServer ? '' : 'hidden'}"
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
      {#if atHome}
        {@render home()}
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
    {:else if serverStatus.unavailable}
      <ServerUnavailable class="absolute inset-0 bg-background" />
    {:else if !ready && !connected}
      <EmptyState icon={BROWSER_ICON} text={t("CONNECTION_ERROR")} class="absolute inset-0 bg-background" />
    {:else if !ready && failed}
      <EmptyState
        icon={BROWSER_ICON}
        text={page.available ? t("BROWSER_FAILED") : t("BROWSER_MISSING")}
        class="absolute inset-0 bg-background"
      />
    {:else if serverAtHome}
      {@render home()}
    {:else if !ready && !page.running && !launching}
      <EmptyState icon={BROWSER_ICON} text={t("BROWSER_MISSING")} class="absolute inset-0 bg-background" />
    {:else if !ready}
      <CenteredProgress class="absolute inset-0 bg-background" />
    {/if}
  </div>
</div>

{#if clearing}
  <BrowserClearDialog site={clearing.site} onDismiss={() => (clearing = null)} />
{/if}

{#if favoriting}
  {@const draft = favoriting}
  <BrowserFavoriteDialog
    url={draft.url}
    title={draft.title}
    onConfirm={addFavorite}
    onDismiss={() => (favoriting = null)}
  />
{/if}

{#if !onServer && deviceBrowser.shown && (pull.fraction > 0 || pullRefreshing)}
  {@const page = deviceBrowser.shown}
  <Portal>
    <div
      style="left: {page.x}px; top: {page.y}px; width: {page.width}px"
      class="pointer-events-none fixed z-10"
    >
      <PullIndicator fraction={pull.fraction} refreshing={pullRefreshing} />
    </div>
  </Portal>
{/if}
