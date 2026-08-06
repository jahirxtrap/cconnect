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
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    url: string;
    filename: string;
    onClose: () => void;
    onDelete?: (() => void) | null;
  }

  const { url, filename, onClose, onDelete = null }: Props = $props();

  const MIN_SCALE = 1;
  const MAX_SCALE = 6;
  const DOUBLE_TAP_SCALE = 2.5;
  const ZOOM_STEP = 0.0015;

  let text = $state<string | null>(null);
  let failed = $state(false);
  let loaded = $state(false);
  let version = $state(0);
  let formatted = $state(settings.markdownPreviewFormatted);
  let confirmingDelete = $state(false);
  let scale = $state(1);
  let offsetX = $state(0);
  let offsetY = $state(0);

  const kind = $derived(previewKindOf(filename));
  const relative = $derived(relativeFromUrl(url));
  const base = $derived(url.split("?fb=")[0]);
  const source = $derived(version > 0 ? `${base}${base.includes("?") ? "&" : "?"}cb=${version}` : base);
  const fallback = $derived.by(() => {
    const encoded = url.split("?fb=")[1];
    return encoded ? decodeURIComponent(encoded) : null;
  });

  const resetZoom = () => {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
  };

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale - event.deltaY * ZOOM_STEP));
    if (scale === MIN_SCALE) {
      offsetX = 0;
      offsetY = 0;
    }
  };

  const onDoubleClick = () => {
    if (scale > MIN_SCALE) resetZoom();
    else scale = DOUBLE_TAP_SCALE;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (scale <= MIN_SCALE) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const move = (drag: PointerEvent) => {
      offsetX += drag.movementX;
      offsetY += drag.movementY;
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  const document_ = $derived.by(() => {
    if (kind !== "html" || text === null) return null;
    const folder = source.slice(0, source.lastIndexOf("/") + 1);
    const tag = `<base href="${folder}">`;
    if (/<base\s/i.test(text)) return text;
    return /<head[^>]*>/i.test(text)
      ? text.replace(/<head([^>]*)>/i, `<head$1>${tag}`)
      : `${tag}${text}`;
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

<div class="fixed inset-0 z-50 flex flex-col bg-background text-on-background">
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
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8 [&_svg]:size-5"
          aria-label={t("FILES")}
        >
          <EllipsisVertical size={20} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            class="menu-surface z-50 min-w-44 rounded-md border border-outline-variant bg-surface-variant p-1 shadow-lg"
          >
            <MenuItem text={t("SAVE")} onclick={() => void downloadShared(url, filename)}>
              {#snippet leading()}
                <Download size={16} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            <MenuItem text={t("SAVE_AS")} onclick={() => void saveSharedAs(url, filename)}>
              {#snippet leading()}
                <Save size={16} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            <MenuItem text={t("SHARE")} onclick={() => void openSharedExternally(url, filename)}>
              {#snippet leading()}
                <Share2 size={16} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            {#if onDelete}
              <MenuItem text={t("DELETE")} onclick={() => (confirmingDelete = true)}>
                {#snippet leading()}
                  <Trash size={16} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    {/snippet}
  </AppTopBar>

  {#if kind === "image"}
    <div
      class="min-h-0 flex-1 overflow-hidden"
      onwheel={onWheel}
      ondblclick={onDoubleClick}
      onpointerdown={onPointerDown}
      role="presentation"
    >
      <img
        use:mediaSrc={{
          url: source,
          fallback,
          onload: () => (loaded = true),
          onerror: () => (failed = true),
        }}
        alt={filename}
        style="transform: translate({offsetX}px, {offsetY}px) scale({scale})"
        class="h-full w-full object-contain transition-transform duration-75 {loaded
          ? ''
          : 'invisible'} {scale > MIN_SCALE ? 'cursor-grab' : ''}"
      />
      {#if failed}
        <EmptyState text={t("FILE_UNAVAILABLE")} class="absolute inset-0" />
      {:else if !loaded}
        <CenteredProgress class="absolute inset-0" />
      {/if}
    </div>
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
    <iframe
      use:mediaSrc={{ url: source, onerror: () => (failed = true) }}
      title={filename}
      class="min-h-0 flex-1 border-0 bg-white"
    ></iframe>
  {:else if kind === "html"}
    {#if failed}
      <EmptyState text={t("FILE_UNAVAILABLE")} class="flex-1" />
    {:else if document_ === null}
      <CenteredProgress class="flex-1" />
    {:else}
      <iframe
        srcdoc={document_}
        title={filename}
        sandbox="allow-scripts"
        class="min-h-0 flex-1 border-0 bg-white"
      ></iframe>
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
