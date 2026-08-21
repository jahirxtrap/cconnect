<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Trash from "@lucide/svelte/icons/trash";
  import Type from "@lucide/svelte/icons/type";
  import { DropdownMenu } from "bits-ui";
  import { previewKindOf } from "$lib/data/previewKind";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { platformName } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { authHeadersOf, backend } from "$lib/services/backend.svelte";
  import { mediaSrc } from "$lib/services/mediaSource";
  import { relativeFromUrl } from "$lib/services/sharedApi";
  import { downloadShared, openSharedExternally, saveSharedAs } from "$lib/services/sharedFiles";
  import { SharedWatch } from "$lib/services/sharedWatch.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuScrim from "$lib/ui/MenuScrim.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ZoomPane from "$lib/ui/ZoomPane.svelte";
  import PdfView from "./PdfView.svelte";
  import { MENU_CONTENT_CLASS } from "$lib/ui/menuSurface";

  interface Props {
    url: string;
    filename: string;
    onClose: () => void;
    onDelete?: (() => void) | null;
  }

  const { url, filename, onClose, onDelete = null }: Props = $props();

  let text = $state<string | null>(null);
  let failed = $state(false);
  let loaded = $state(false);
  let version = $state(0);
  let formatted = $state(settings.markdownPreviewFormatted);
  let menu = $state(false);
  let confirmingDelete = $state(false);
  let frame = $state<HTMLIFrameElement | null>(null);
  let frameWidth = $state(0);
  let frameHeight = $state(0);
  let documentWidth = $state(0);

  const kind = $derived(previewKindOf(filename));
  const relative = $derived(relativeFromUrl(url));
  const base = $derived(url.split("?fb=")[0]);
  const source = $derived(version > 0 ? `${base}${base.includes("?") ? "&" : "?"}cb=${version}` : base);
  const fallback = $derived.by(() => {
    const encoded = url.split("?fb=")[1];
    return encoded ? decodeURIComponent(encoded) : null;
  });

  const WIDTH_CHANNEL = "cconnect:width";
  const FIT_TAGS =
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<style>img,video,canvas,svg,table{max-width:100%;height:auto}</style>` +
    `<script>(function(){var report=function(){try{parent.postMessage({channel:"${WIDTH_CHANNEL}",` +
    `width:Math.max(document.documentElement.scrollWidth,document.body?document.body.scrollWidth:0)},"*")}catch(e){}};` +
    `addEventListener("load",report);addEventListener("resize",report);setInterval(report,1000);report()})()</` +
    `script>`;

  const htmlScale = $derived(documentWidth > frameWidth && frameWidth > 0 ? frameWidth / documentWidth : 1);

  $effect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame || event.source !== frame.contentWindow) return;
      const payload = event.data as { channel?: string; width?: number } | null;
      if (!payload || payload.channel !== WIDTH_CHANNEL || typeof payload.width !== "number") return;
      documentWidth = Math.max(payload.width, frameWidth);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  const document_ = $derived.by(() => {
    if (kind !== "html" || text === null) return null;
    const folder = source.slice(0, source.lastIndexOf("/") + 1);
    const base = /<base\s/i.test(text) ? "" : `<base href="${folder}">`;
    const tags = `${base}${FIT_TAGS}`;
    return /<head[^>]*>/i.test(text) ? text.replace(/<head([^>]*)>/i, `<head$1>${tags}`) : `${tags}${text}`;
  });

  $effect(() => {
    const target = source;
    if (kind !== "markdown" && kind !== "text" && kind !== "html") return;
    text = null;
    failed = false;
    void fetch(target, { headers: authHeadersOf(backend.active) })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        text = await response.text();
      })
      .catch(() => (failed = true));
  });

  $effect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
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

<div class="safe-area fixed inset-0 z-50 flex flex-col bg-background text-on-background">
  <AppTopBar title={t("VIEW")} subtitle={filename}>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={onClose}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
    {#snippet actions()}
      {#if kind === "markdown"}
        <TooltipIconButton
          label={t("FORMATTED_VIEW")}
          onclick={() => {
            formatted = !formatted;
            settings.markdownPreviewFormatted = formatted;
          }}
        >
          <Type size={20} class={formatted ? "text-accent" : ""} />
        </TooltipIconButton>
      {/if}
      <MenuScrim open={menu} onDismiss={() => (menu = false)} />
      <DropdownMenu.Root open={menu} onOpenChange={(value) => (menu = value)}>
        <DropdownMenu.Trigger
          class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8 [&_svg]:size-5"
          aria-label={t("MORE_OPTIONS")}
        >
          <EllipsisVertical size={20} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            align="end"
            sideOffset={4}
            collisionPadding={layout.menuPadding}
            class={MENU_CONTENT_CLASS}
          >
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
            <MenuItem text={t("SHARE")} onclick={() => void openSharedExternally(url, filename)}>
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
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    {/snippet}
  </AppTopBar>

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
      <iframe
        use:mediaSrc={{ url: source, onerror: () => (failed = true) }}
        title={filename}
        class="min-h-0 flex-1 border-0 bg-white"
      ></iframe>
    {/if}
  {:else if kind === "html"}
    {#if failed}
      <EmptyState text={t("FILE_UNAVAILABLE")} class="flex-1" />
    {:else if document_ === null}
      <CenteredProgress class="flex-1" />
    {:else}
      <div class="min-h-0 flex-1 overflow-hidden bg-white" bind:clientWidth={frameWidth} bind:clientHeight={frameHeight}>
        <iframe
          bind:this={frame}
          srcdoc={document_}
          title={filename}
          sandbox="allow-scripts"
          style="width: {documentWidth || frameWidth}px; height: {frameHeight / htmlScale}px; transform: scale({htmlScale}); transform-origin: top left"
          class="border-0 bg-white"
        ></iframe>
      </div>
    {/if}
  {:else if failed}
    <EmptyState text={t("FILE_UNAVAILABLE")} class="flex-1" />
  {:else if text === null}
    <CenteredProgress class="flex-1" />
  {:else}
    <div class="selectable min-h-0 flex-1 overflow-y-auto p-4">
      {#if kind === "markdown" && formatted}
        <MarkdownText {text} />
      {:else}
        <pre class="font-mono text-body-sm whitespace-pre-wrap">{text}</pre>
      {/if}
    </div>
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
