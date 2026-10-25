<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Maximize2 from "@lucide/svelte/icons/maximize-2";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Trash from "@lucide/svelte/icons/trash";
  import Type from "@lucide/svelte/icons/type";
  import type { Snippet } from "svelte";
  import { extensionOf, previewKindOf, readsAsText, type PreviewKind } from "$lib/data/previewKind";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { platformName } from "$lib/platform";
  import { backend } from "$lib/services/backend.svelte";
  import { mediaSrc } from "$lib/services/mediaSource";
  import { relativeFromUrl, sharedApi } from "$lib/services/sharedApi";
  import { copyText } from "$lib/platform/clipboard";
  import CenterViewToggle from "$lib/screens/chat/CenterViewToggle.svelte";
  import { paneRole } from "$lib/screens/chat/paneSurface";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import {
    downloadShared,
    openSharedExternally,
    saveSharedAs,
    shareShared,
  } from "$lib/services/sharedFiles";
  import { SharedWatch } from "$lib/services/sharedWatch.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CodeView from "$lib/ui/CodeView.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { frameScrollbars, themedPage } from "$lib/ui/frameScrollbars.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { TEXT_VIEWPORT_CLASS, viewportScrollbar } from "$lib/ui/scrollbar";
  import ZoomPane from "$lib/ui/ZoomPane.svelte";
  import PdfView from "./PdfView.svelte";

  interface Props {
    url: string;
    filename: string;
    onClose: () => void;
    onDelete?: (() => void) | null;
    embedded?: boolean;
    onExpand?: (() => void) | null;
    menuItems?: Snippet;
    actions?: Snippet<[boolean]>;
    onCopyPath?: (() => void) | null;
    added?: number[];
    removed?: Record<number, string[]>;
    current?: number[];
    anchor?: number | null;
    ready?: boolean;
    revision?: number;
    forcedKind?: PreviewKind | null;
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
    menuItems,
    actions,
    onCopyPath = null,
    added = [],
    removed = {},
    current = [],
    anchor = null,
    ready = true,
    revision = 0,
    forcedKind = null,
  }: Props = $props();

  const NUL = String.fromCharCode(0);

  const centered = paneRole() === "center";


  let arrived = $state<{ base: string; name: string; body: string } | null>(null);
  let shown = $state<Shown | null>(null);
  let failed = $state(false);
  let loaded = $state(false);
  let version = $state(0);
  let formatted = $state(settings.markdownPreviewFormatted);
  let menu = $state(false);
  let confirmingDelete = $state(false);
  let pdfWidth = $state(0);

  const PDF_RESIZE_STEP = 96;
  const BODY_CLASS = "flex min-h-0 flex-1 flex-col";
  const FRAME_CLASS = `${BODY_CLASS} mx-(--page-inset) mb-(--page-inset) overflow-hidden rounded-panel`;
  const TEXT_SCROLL_CLASS = `${TEXT_VIEWPORT_CLASS} selectable min-h-0 flex-1 px-(--page-inset)`;

  const pdfStep = $derived(Math.round(pdfWidth / PDF_RESIZE_STEP));

  const kind = $derived(forcedKind ?? previewKindOf(filename));
  const bodyClass = $derived(readsAsText(kind) ? BODY_CLASS : FRAME_CLASS);
  const binary = $derived(shown !== null && shown.body.includes(NUL));
  const prose = $derived(shown !== null && previewKindOf(shown.name) === "markdown" && formatted);
  const lined = $derived(readsAsText(kind) && !failed && shown !== null && !binary && !prose);
  const relative = $derived(relativeFromUrl(url));

  const attach = $derived.by(() => {
    const path = relative;
    if (!path) return null;
    return () => {
      const target = panes.focusedTab;
      if (target) tabs.stateFor(target).addSharedAttachments([{ path, name: filename, size: 0 }]);
    };
  });

  const copyPath = $derived(
    onCopyPath ??
      (relative === null
        ? null
        : () => void sharedApi.absolutePaths([relative]).then((paths) => paths && copyText(paths[0]))),
  );
  const base = $derived(url.split("?fb=")[0]);
  const stamp = $derived(version + revision);
  const source = $derived(stamp > 0 ? `${base}${base.includes("?") ? "&" : "?"}cb=${stamp}` : base);
  const fallback = $derived.by(() => {
    const encoded = url.split("?fb=")[1];
    return encoded ? decodeURIComponent(encoded) : null;
  });

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
    void fetch(target, { headers: securityKeys.fileHeadersFor(backend.sharedProfileOf(target)) })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        arrived = { base: requested, name, body: await response.text() };
      })
      .catch(() => (failed = true));
  });

  $effect(() => {
    if (arrived === null || arrived.base !== base || !ready) return;
    shown = { ...arrived, added, removed, current, anchor };
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
        const entry = watch.entries?.find((item) => item.name === name);
        if (!entry) return;
        const next = `${entry.size}:${entry.modified}`;
        if (signature === null) signature = next;
        else if (signature !== next) {
          signature = next;
          version++;
          loaded = false;
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
    {@render menuItems?.()}
    {#if attach}
      <MenuItem text={t("ATTACH_TO_CHAT")} icon={Paperclip} onclick={attach} />
    {/if}
    <MenuItem text={t("SAVE")} icon={Download} onclick={() => void downloadShared(url, filename)} />
    <MenuItem text={t("SAVE_AS")} icon={Save} onclick={() => void saveSharedAs(url, filename)} />
    <MenuItem
      text={t("OPEN_EXTERNALLY")}
      icon={ExternalLink}
      onclick={() => void openSharedExternally(url, filename)}
    />
    {#if copyPath}
      <MenuItem text={t("COPY_PATH")} icon={ClipboardCopy} onclick={copyPath} />
    {/if}
    <MenuItem text={t("SHARE")} icon={Share2} onclick={() => void shareShared(url, filename)} />
    {#if onDelete}
      <MenuItem text={t("DELETE")} icon={Trash} danger onclick={() => (confirmingDelete = true)} />
    {/if}
  </PopupMenu>
{/snippet}

{#snippet body()}
  {#if kind === "image"}
    <ZoomPane class="min-h-0 flex-1">
      <img
        use:mediaSrc={{
          url: source,
          fallback,
          onload: () => (loaded = true),
          onerror: () => (failed = true),
        }}
        alt={filename}
        draggable="false"
        data-native-menu
        class="h-full w-full object-contain {loaded ? '' : 'invisible'}"
      />
      {#if failed}
        <EmptyState text={t("FILE_UNAVAILABLE")} class="absolute inset-0" />
      {:else if !loaded}
        <CenteredProgress class="absolute inset-0" />
      {/if}
    </ZoomPane>
  {:else if kind === "video"}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      use:mediaSrc={{ url: source, onerror: () => (failed = true) }}
      controls
      class="min-h-0 flex-1 bg-black"
    ></video>
  {:else if kind === "audio"}
    <div class="flex min-h-0 flex-1 items-center justify-center p-6">
      <audio
        use:mediaSrc={{ url: source, onerror: () => (failed = true) }}
        controls
        class="w-full max-w-lg"
      ></audio>
    </div>
  {:else if kind === "pdf"}
    {#if failed}
      <EmptyState text={t("FILE_UNAVAILABLE")} class="flex-1" />
    {:else if platformName() === "android"}
      <PdfView url={source} onerror={() => (failed = true)} />
    {:else}
      <div bind:clientWidth={pdfWidth} class="flex min-h-0 w-full flex-1">
        {#key pdfStep}
          <iframe
            use:mediaSrc={{ url: source, onerror: () => (failed = true) }}
            title={filename}
            class="min-h-0 w-full flex-1 border-0"
          ></iframe>
        {/key}
      </div>
    {/if}
  {:else if kind === "html"}
    <iframe
      use:mediaSrc={{ url: source, transform: themedPage, onerror: () => (failed = true) }}
      use:frameScrollbars
      title={filename}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      class="min-h-0 w-full flex-1 border-0"
    ></iframe>
  {:else if failed}
    <EmptyState text={t("FILE_UNAVAILABLE")} class="flex-1" />
  {:else if shown === null}
    <CenteredProgress class="flex-1" />
  {:else if binary}
    <EmptyState text={t("FILE_BINARY")} class="flex-1" />
  {:else if prose}
    {#key shown.base}
      <div use:viewportScrollbar class="{TEXT_SCROLL_CLASS} overflow-y-auto py-4">
        <MarkdownText text={shown.body} />
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

{#if embedded}
  <div class="flex h-full min-h-0 flex-col bg-background text-on-surface">
    <PaneHeader title={filename} onBack={onClose} actions={toolbar} />
    <div class={bodyClass}>
      {@render body()}
    </div>
  </div>
{:else}
  <div class="safe-area above-keyboard fixed inset-0 z-50 flex flex-col bg-background text-on-surface">
    <AppTopBar title={t("VIEW")} subtitle={filename} actions={toolbar}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={onClose}>
          <ArrowLeft />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>
    <div class={bodyClass}>
      {@render body()}
    </div>
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
