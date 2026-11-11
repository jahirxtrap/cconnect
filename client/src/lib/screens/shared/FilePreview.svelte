<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Maximize2 from "@lucide/svelte/icons/maximize-2";
  import Type from "@lucide/svelte/icons/type";
  import type { Snippet } from "svelte";
  import type { PreviewLinks, PreviewRequest } from "$lib/app/navigation.svelte";
  import type { DatabaseFileSource } from "$lib/data/databaseModels";
  import { extensionOf, previewKindOf, readsAsText, type PreviewKind } from "$lib/data/previewKind";
  import { wikiLinks } from "$lib/markdown/render";
  import { settings } from "$lib/data/settings.svelte";
  import { fallbackOf, revised, withoutFallback } from "$lib/data/url";
  import { t } from "$lib/i18n/index.svelte";
  import { fetchFile, imageSrc, servedSrc } from "$lib/services/mediaSource";
  import { relativeFromUrl, sharedApi } from "$lib/services/sharedApi";
  import { copyText } from "$lib/platform/clipboard";
  import CenterViewToggle from "$lib/screens/chat/CenterViewToggle.svelte";
  import DatabaseFile from "$lib/screens/databases/DatabaseFile.svelte";
  import { isMobile } from "$lib/platform";
  import { pdfScreenAvailable } from "$lib/platform/androidPdf";
  import { layout } from "$lib/platform/layout.svelte";
  import { paneRole } from "$lib/screens/chat/paneSurface";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { mentionInChat } from "$lib/screens/chat/mention";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { SharedWatch } from "$lib/services/sharedWatch.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CodeView from "$lib/ui/CodeView.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { fileIcon } from "$lib/ui/fileIcons";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { TEXT_VIEWPORT_CLASS, viewportScrollbar } from "$lib/ui/scrollbar";
  import FileActionItems from "$lib/ui/FileActionItems.svelte";
  import { FILE_ACTIONS, fileEntries, type FileActionEntry } from "$lib/ui/sharedFileActions";
  import PageFrame from "$lib/ui/PageFrame.svelte";
  import { pageZoom } from "$lib/ui/pageZoom.svelte";
  import ZoomMenu from "$lib/ui/ZoomMenu.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import TabPager, { TAB_PAGE_CLASS } from "$lib/ui/TabPager.svelte";
  import ZoomPane from "$lib/ui/ZoomPane.svelte";
  import GallerySlide, { GALLERY_KINDS } from "./GallerySlide.svelte";
  import GalleryStrip from "./GalleryStrip.svelte";
  import NativePdfScreen from "./NativePdfScreen.svelte";
  import PdfView from "./PdfView.svelte";

  interface Props {
    url: string;
    filename: string;
    onClose: () => void;
    onDelete?: (() => void) | null;
    embedded?: boolean;
    onExpand?: (() => void) | null;
    extraActions?: FileActionEntry[];
    actions?: Snippet<[boolean]>;
    onCopyPath?: (() => void) | null;
    added?: number[];
    removed?: Record<number, string[]>;
    current?: number[];
    anchor?: number | null;
    ready?: boolean;
    revision?: number;
    forcedKind?: PreviewKind | null;
    links?: PreviewLinks | null;
    gallery?: PreviewRequest[] | null;
    onPick?: ((index: number) => void) | null;
    databaseFile?: DatabaseFileSource | null;
  }

  interface Shown {
    base: string;
    name: string;
    body: string;
    added: number[];
    removed: Record<number, string[]>;
    current: number[];
    anchor: number | null;
  }

  const {
    url,
    filename,
    onClose,
    onDelete = null,
    embedded = false,
    onExpand = null,
    extraActions = [],
    actions,
    onCopyPath = null,
    added = [],
    removed = {},
    current = [],
    anchor = null,
    ready = true,
    revision = 0,
    forcedKind = null,
    links = null,
    gallery = null,
    onPick = null,
    databaseFile = null,
  }: Props = $props();

  const NUL = String.fromCharCode(0);
  const PDF_RESIZE_SETTLE_MS = 300;

  const centered = paneRole() === "center";
  const nativePdf = $derived((!embedded || centered) && !isMobile && !layout.mobile);
  const androidPdf = $derived(!embedded && pdfScreenAvailable());

  const refitOnResize = (node: HTMLIFrameElement) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let width = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (!width || next === width) {
        width = next;
        return;
      }
      width = next;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (node.src) node.src = node.src;
      }, PDF_RESIZE_SETTLE_MS);
    });
    observer.observe(node);
    return {
      destroy() {
        observer.disconnect();
        if (timer !== null) clearTimeout(timer);
      },
    };
  };

  let arrived = $state<{ base: string; name: string; body: string } | null>(null);
  let shown = $state<Shown | null>(null);
  let failed = $state(false);
  let loadedFor = $state<string | null>(null);
  let version = $state(0);
  let formatted = $state(settings.markdownPreviewFormatted);
  let menu = $state(false);
  let confirmingDelete = $state(false);

  const BODY_CLASS = "flex min-h-0 flex-1 flex-col";
  const FRAME_CLASS = `${BODY_CLASS} overflow-hidden rounded-panel`;
  const PANE_SIDES_CLASS = `${FRAME_CLASS} mx-(--page-inset)`;
  const PANE_FRAME_CLASS = `${PANE_SIDES_CLASS} mb-(--page-inset)`;
  const PAGE_ZOOM_KEYS = { in: "preview.zoom.in", out: "preview.zoom.out", reset: "preview.zoom.reset" };
  const TEXT_SCROLL_CLASS = `${TEXT_VIEWPORT_CLASS} selectable min-h-0 flex-1`;

  const kind = $derived(forcedKind ?? previewKindOf(filename));
  const paged = () => kind === "html";

  useShortcut("preview.zoom.in", () => pageZoom.step(1), paged);
  useShortcut("preview.zoom.out", () => pageZoom.step(-1), paged);
  useShortcut("preview.zoom.reset", () => pageZoom.reset(), paged);

  const strip = $derived(
    gallery && gallery.length > 1 && onPick
      ? { items: gallery, onPick, index: gallery.findIndex((item) => item.url === url) }
      : null,
  );

  const pickPage = (index: number) => {
    if (strip && index !== strip.index && index >= 0 && index < strip.items.length) strip.onPick(index);
  };

  const stepGallery = (step: number) => {
    if (strip) pickPage(strip.index + step);
  };
  const paneClass = $derived(strip ? PANE_SIDES_CLASS : PANE_FRAME_CLASS);
  const bodyClass = $derived(readsAsText(kind) || kind === "database" ? BODY_CLASS : embedded ? paneClass : FRAME_CLASS);
  const binary = $derived(shown !== null && shown.body.includes(NUL));
  const prose = $derived(shown !== null && previewKindOf(shown.name) === "markdown" && formatted);
  const lined = $derived(readsAsText(kind) && !failed && shown !== null && !binary && !prose);
  const relative = $derived(relativeFromUrl(url));
  const databaseSource = $derived(databaseFile ?? (relative === null ? null : { project: null, path: relative }));

  const attach = $derived.by(() => {
    const path = relative;
    if (!path) return null;
    return () => {
      const target = panes.focusedTab;
      if (target) tabs.stateFor(target).addSharedAttachments([{ path, name: filename }]);
    };
  });

  const copyPath = $derived(
    onCopyPath ??
      (relative === null
        ? null
        : () => void sharedApi.absolutePaths([relative]).then((paths) => paths && copyText(paths[0]))),
  );

  const mention = $derived(
    relative === null
      ? null
      : () => void sharedApi.absolutePaths([relative]).then((paths) => paths && mentionInChat(paths[0])),
  );

  const menuActions = $derived.by(() => {
    const entries: FileActionEntry[] = [...extraActions, ...fileEntries(FILE_ACTIONS, { url }, filename)];
    if (attach) entries.push({ id: "attach", run: attach });
    if (mention) entries.push({ id: "mention", run: mention });
    if (copyPath) entries.push({ id: "copyPath", run: copyPath });
    if (onDelete) entries.push({ id: "delete", run: () => (confirmingDelete = true) });
    return entries;
  });
  const base = $derived(withoutFallback(url));
  const stamp = $derived(version + revision);
  const source = $derived(revised(base, stamp));
  const fallback = $derived(fallbackOf(url));
  const loaded = $derived(loadedFor === source);

  $effect(() => {
    const target = source;
    const requested = base;
    const name = filename;
    if (!readsAsText(kind)) {
      arrived = null;
      shown = null;
      return;
    }
    failed = false;
    let active = true;
    void fetchFile(target)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.text();
        if (active) arrived = { base: requested, name, body };
      })
      .catch(() => {
        if (active) failed = true;
      });
    return () => {
      active = false;
    };
  });

  $effect(() => {
    if (arrived === null || arrived.base !== base || !ready) return;
    shown = { ...arrived, added, removed, current, anchor };
  });

  $effect(() => {
    void url;
    failed = false;
    version = 0;
  });

  $effect(() => {
    const path = relative;
    if (!path) return;
    const watch = new SharedWatch();
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const name = path.slice(path.lastIndexOf("/") + 1);
    let signature: string | null = null;
    watch.connect();
    watch.watch(folder);
    const stop = $effect.root(() => {
      $effect(() => {
        const entries = watch.entries;
        if (!entries) return;
        const entry = entries.find((item) => item.name === name);
        const next = entry ? `${entry.size}:${entry.modified}` : "";
        if (signature === null) signature = next;
        else if (signature !== next) {
          signature = next;
          version++;
          failed = false;
        }
      });
    });
    return () => {
      stop();
      watch.close();
    };
  });
</script>

{#snippet toolbar()}
  {@render actions?.(lined)}
  {#if centered}
    <CenterViewToggle />
  {/if}
  {#if onExpand}
    <TooltipIconButton label={t("EXPAND")} onclick={onExpand}>
      <Maximize2 />
    </TooltipIconButton>
  {/if}
  {#if kind === "markdown"}
    <TooltipIconButton
      label={t("FORMATTED_VIEW")}
      active={formatted}
      onclick={() => {
        formatted = !formatted;
        settings.markdownPreviewFormatted = formatted;
      }}
    >
      <Type />
    </TooltipIconButton>
  {/if}
  <PopupMenu
    open={menu}
    onOpenChange={(value) => (menu = value)}
    label={t("MORE_OPTIONS")}
  >
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("MORE_OPTIONS")} {...props}>
        <EllipsisVertical />
      </TooltipIconButton>
    {/snippet}
    {#if kind === "html"}
      <ZoomMenu
        zoom={pageZoom.value}
        shortcuts={PAGE_ZOOM_KEYS}
        onZoom={(step) => pageZoom.step(step)}
        onReset={() => pageZoom.reset()}
      />
    {/if}
    <FileActionItems actions={menuActions} />
  </PopupMenu>
{/snippet}

{#snippet body()}
  {#if kind === "image"}
    <ZoomPane class="min-h-0 flex-1">
      <img
        use:imageSrc={{
          url: source,
          fallback,
          onload: () => (loadedFor = source),
          onerror: () => (failed = true),
        }}
        alt={filename}
        draggable="false"
        data-native-menu
        class="h-full w-full object-contain {failed ? 'invisible' : ''}"
      />
      {#if failed}
        <EmptyState icon={fileIcon(filename)} text={t("FILE_UNAVAILABLE")} class="absolute inset-0" />
      {:else if !loaded}
        <CenteredProgress class="absolute inset-0" />
      {/if}
    </ZoomPane>
  {:else if kind === "video"}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      use:servedSrc={{ url: source, onerror: () => (failed = true) }}
      controls
      class="min-h-0 flex-1"
    ></video>
  {:else if kind === "audio"}
    <div class="flex min-h-0 flex-1 items-center justify-center p-6">
      <audio
        use:servedSrc={{ url: source, onerror: () => (failed = true) }}
        controls
        class="w-full max-w-lg"
      ></audio>
    </div>
  {:else if kind === "pdf"}
    {#if failed}
      <EmptyState icon={fileIcon(filename)} text={t("FILE_UNAVAILABLE")} class="flex-1" />
    {:else if nativePdf}
      <iframe
        use:servedSrc={{ url: source, onerror: () => (failed = true) }}
        use:refitOnResize
        title={filename}
        class="min-h-0 w-full flex-1 border-0"
      ></iframe>
    {:else if androidPdf}
      <NativePdfScreen url={source} onerror={() => (failed = true)} />
    {:else}
      <PdfView url={source} onerror={() => (failed = true)} />
    {/if}
  {:else if kind === "database"}
    {#if databaseSource}
      <DatabaseFile source={databaseSource} {filename} {embedded} revision={stamp} {onExpand} />
    {:else}
      <EmptyState icon={fileIcon(filename)} text={t("FILE_BINARY")} class="flex-1" />
    {/if}
  {:else if kind === "html"}
    <PageFrame
      url={source}
      name={filename}
      title={filename}
      zoomable
      onerror={() => (failed = true)}
      class="min-h-0 w-full flex-1 border-0"
    />
  {:else if failed}
    <EmptyState icon={fileIcon(filename)} text={t("FILE_UNAVAILABLE")} class="flex-1" />
  {:else if shown === null}
    <CenteredProgress class="flex-1" />
  {:else if binary}
    <EmptyState icon={fileIcon(filename)} text={t("FILE_BINARY")} class="flex-1" />
  {:else if prose}
    {#key shown.base}
      <div use:viewportScrollbar class="{TEXT_SCROLL_CLASS} overflow-y-auto px-2.5 py-3">
        <MarkdownText
          text={links?.wiki ? wikiLinks(shown.body) : shown.body}
          linkTarget={links?.resolve ?? null}
          flavor="document"
          fileUrl={url}
        />
      </div>
    {/key}
  {:else}
    {#key shown.base}
      <CodeView
        text={shown.body}
        lang={extensionOf(shown.name)}
        added={shown.added}
        removed={shown.removed}
        current={shown.current}
        anchor={shown.anchor}
        numbers={settings.codeLineNumbers}
        class={TEXT_SCROLL_CLASS}
      />
    {/key}
  {/if}
{/snippet}

{#snippet content()}
  <div class={bodyClass}>
    {#if strip}
      <TabPager selected={strip.index} onSelect={pickPage} class="min-h-0 flex-1">
        {#each strip.items as item, position (position)}
          {@const near = Math.abs(position - strip.index) <= 1}
          <div class="{TAB_PAGE_CLASS} min-h-0 snap-always">
            {#if position === strip.index && !GALLERY_KINDS.includes(kind)}
              {#key url}
                {@render body()}
              {/key}
            {:else if near}
              <GallerySlide {item} active={position === strip.index} revision={position === strip.index ? stamp : 0} />
            {/if}
          </div>
        {/each}
      </TabPager>
    {:else}
      {#key url}
        {@render body()}
      {/key}
    {/if}
  </div>
  {#if strip}
    <GalleryStrip items={strip.items} index={strip.index} onStep={stepGallery} onPick={strip.onPick} />
  {/if}
{/snippet}

{#if embedded}
  <div class="relative flex h-full min-h-0 flex-col bg-background text-on-surface">
    <PaneHeader title={filename} onBack={onClose} actions={toolbar} />
    {@render content()}
  </div>
{:else}
  <div
    class="safe-area above-keyboard fixed inset-0 z-50 flex flex-col bg-background text-on-surface {androidPdf &&
    kind === 'pdf'
      ? 'pdf-screen-root'
      : ''}"
  >
    <AppTopBar title={t("VIEW")} subtitle={filename} actions={toolbar}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={onClose}>
          <ArrowLeft />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>
    {@render content()}
  </div>
{/if}

{#if confirmingDelete && onDelete}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_FILE_CONFIRM", filename)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => {
      confirmingDelete = false;
      onDelete();
      onClose();
    }}
    onDismiss={() => (confirmingDelete = false)}
  />
{/if}
