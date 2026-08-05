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
  import { downloadShared, openSharedExternally, saveSharedAs } from "$lib/services/sharedFiles";
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
  let formatted = $state(settings.markdownPreviewFormatted);
  let confirmingDelete = $state(false);
  let scale = $state(1);
  let offsetX = $state(0);
  let offsetY = $state(0);

  const kind = $derived(previewKindOf(filename));
  const imageUrl = $derived(url.split("?fb=")[0]);

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

  $effect(() => {
    const target = url;
    if (kind === "image" || kind === "html") return;
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
          class="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8 [&_svg]:size-6"
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
        src={imageUrl}
        alt={filename}
        onerror={() => (failed = true)}
        style="transform: translate({offsetX}px, {offsetY}px) scale({scale})"
        class="h-full w-full object-contain transition-transform duration-75 {scale > MIN_SCALE
          ? 'cursor-grab'
          : ''}"
      />
      {#if failed}
        <EmptyState text={t("FILE_UNAVAILABLE")} class="absolute inset-0" />
      {/if}
    </div>
  {:else if kind === "html"}
    <iframe src={url} title={filename} sandbox="allow-same-origin" class="min-h-0 flex-1 border-0 bg-white"></iframe>
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
