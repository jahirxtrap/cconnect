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
  import { extensionOf, previewKindOf, readsAsText } from "$lib/data/previewKind";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { platformName } from "$lib/platform";
  import { authHeadersOf, backend } from "$lib/services/backend.svelte";
  import { mediaSrc } from "$lib/services/mediaSource";
  import { relativeFromUrl, sharedApi } from "$lib/services/sharedApi";
  import { copyText } from "$lib/platform/clipboard";
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
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ZoomPane from "$lib/ui/ZoomPane.svelte";
  import PdfView from "./PdfView.svelte";

  export interface ToolbarButton {
    class: string;
    size: number;
  }

  interface Props {
    url: string;
    filename: string;
    onClose: () => void;
    onDelete?: (() => void) | null;
    embedded?: boolean;
    onExpand?: (() => void) | null;
    menuItems?: Snippet;
    actions?: Snippet<[ToolbarButton]>;
    onCopyPath?: (() => void) | null;
    added?: number[];
    removed?: Record<number, string[]>;
    current?: number[];
    anchor?: number | null;
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
  }: Props = $props();

  const NUL = String.fromCharCode(0);

  const button = $derived<ToolbarButton>({ class: embedded ? "size-8" : "", size: embedded ? 18 : 20 });

  let text = $state<string | null>(null);
  let failed = $state(false);
  let loaded = $state(false);
  let version = $state(0);
  let formatted = $state(settings.markdownPreviewFormatted);
  let menu = $state(false);
  let confirmingDelete = $state(false);
  let pdfWidth = $state(0);

  const PDF_RESIZE_STEP = 96;

  const pdfStep = $derived(Math.round(pdfWidth / PDF_RESIZE_STEP));

  const kind = $derived(previewKindOf(filename));
  const binary = $derived(text !== null && text.includes(NUL));
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
  const source = $derived(version > 0 ? `${base}${base.includes("?") ? "&" : "?"}cb=${version}` : base);
  const fallback = $derived.by(() => {
    const encoded = url.split("?fb=")[1];
    return encoded ? decodeURIComponent(encoded) : null;
  });

  let shownFile = "";

  $effect(() => {
    const target = source;
    if (!readsAsText(kind)) return;
    if (base !== shownFile) {
      shownFile = base;
      text = null;
    }
    failed = false;
    void fetch(target, {
      headers: { ...authHeadersOf(backend.active), ...securityKeys.headersFor(backend.active) },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        text = await response.text();
      })
      .catch(() => (failed = true));
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
  {@render actions?.(button)}
  {#if onExpand}
    <TooltipIconButton label={t("EXPAND")} class={button.class} onclick={onExpand}>
      <Maximize2 size={button.size} />
    </TooltipIconButton>
  {/if}
  {#if kind === "markdown"}
    <TooltipIconButton
      label={t("FORMATTED_VIEW")}
      class={button.class}
      onclick={() => {
        formatted = !formatted;
        settings.markdownPreviewFormatted = formatted;
      }}
    >
      <Type size={button.size} class={formatted ? "text-accent" : ""} />
    </TooltipIconButton>
  {/if}
  <PopupMenu
    open={menu}
    onOpenChange={(value) => (menu = value)}
    label={t("MORE_OPTIONS")}
    align="center"
  >
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("MORE_OPTIONS")} class={button.class} {...props}>
        <EllipsisVertical size={button.size} />
      </TooltipIconButton>
    {/snippet}
    {@render menuItems?.()}
    {#if attach}
      <MenuItem text={t("ATTACH_TO_CHAT")} onclick={attach}>
        {#snippet leading()}
          <Paperclip size={20} class="shrink-0 text-on-surface-variant" />
        {/snippet}
      </MenuItem>
    {/if}
    <MenuItem text={t("SAVE")} onclick={() => void downloadShared(url, filename)}>
      {#snippet leading()}
        <Download size={20} class="shrink-0 text-on-surface-variant" />
      {/snippet}
    </MenuItem>
    <MenuItem text={t("SAVE_AS")} onclick={() => void saveSharedAs(url, filename)}>
      {#snippet leading()}
        <Save size={20} class="shrink-0 text-on-surface-variant" />
      {/snippet}
    </MenuItem>
    <MenuItem text={t("OPEN_EXTERNALLY")} onclick={() => void openSharedExternally(url, filename)}>
      {#snippet leading()}
        <ExternalLink size={20} class="shrink-0 text-on-surface-variant" />
      {/snippet}
    </MenuItem>
    {#if copyPath}
      <MenuItem text={t("COPY_PATH")} onclick={copyPath}>
        {#snippet leading()}
          <ClipboardCopy size={20} class="shrink-0 text-on-surface-variant" />
        {/snippet}
      </MenuItem>
    {/if}
    <MenuItem text={t("SHARE")} onclick={() => void shareShared(url, filename)}>
      {#snippet leading()}
        <Share2 size={20} class="shrink-0 text-on-surface-variant" />
      {/snippet}
    </MenuItem>
    {#if onDelete}
      <MenuItem text={t("DELETE")} onclick={() => (confirmingDelete = true)}>
        {#snippet leading()}
          <Trash size={20} class="shrink-0 text-on-surface-variant" />
        {/snippet}
      </MenuItem>
    {/if}
  </PopupMenu>
{/snippet}

<div
  class="bg-background text-on-background {embedded
    ? 'flex h-full min-h-0 flex-col'
    : 'safe-area above-keyboard fixed inset-0 z-50 flex flex-col'}"
>
  {#if embedded}
    <PaneHeader title={filename} onBack={onClose} actions={toolbar} />
  {:else}
    <AppTopBar title={t("VIEW")} subtitle={filename} actions={toolbar}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={onClose}>
          <ArrowLeft size={20} />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>
  {/if}

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
            class="min-h-0 w-full flex-1 border-0 bg-white"
          ></iframe>
        {/key}
      </div>
    {/if}
  {:else if kind === "html"}
    <iframe
      use:mediaSrc={{ url: source, onerror: () => (failed = true) }}
      title={filename}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      class="min-h-0 w-full flex-1 border-0 bg-white"
    ></iframe>
  {:else if failed}
    <EmptyState text={t("FILE_UNAVAILABLE")} class="flex-1" />
  {:else if text === null}
    <CenteredProgress class="flex-1" />
  {:else if binary}
    <EmptyState text={t("FILE_BINARY")} class="flex-1" />
  {:else if kind === "markdown" && formatted}
    <div class="selectable min-h-0 flex-1 overflow-y-auto p-4">
      <MarkdownText {text} />
    </div>
  {:else}
    <CodeView
      {text}
      lang={extensionOf(filename)}
      {added}
      {removed}
      {current}
      {anchor}
      class="selectable min-h-0 flex-1"
    />
  {/if}
</div>

{#if confirmingDelete && onDelete}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_FILE_CONFIRM", filename)}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      confirmingDelete = false;
      onDelete();
      onClose();
    }}
    onDismiss={() => (confirmingDelete = false)}
  />
{/if}
