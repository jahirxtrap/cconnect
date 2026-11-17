<script lang="ts">
  import { openFilePreview } from "$lib/app/filePreview";
  import { t } from "$lib/i18n/index.svelte";
  import { nameOf, type DrawingSource } from "$lib/markdown/drawing";
  import { contextServer, contextSharedFolder } from "$lib/services/serverContext";
  import { drawingActions } from "./drawingActions";
  import DrawingView from "./DrawingView.svelte";
  import FileActionItems from "./FileActionItems.svelte";
  import { gridHeight } from "./gridHeight";
  import { MEDIA_FRAME_CLASS } from "./mediaFrame";
  import { menuPointOf, type MenuPoint } from "./menuSurface";
  import PopupMenu from "./PopupMenu.svelte";
  import SharedLinkActionsDialog from "./SharedLinkActionsDialog.svelte";
  import type { FileActionEntry } from "./sharedFileActions";

  interface Props {
    svg: string;
    size: string;
  }

  const { svg, size }: Props = $props();

  const server = contextServer();
  const folder = contextSharedFolder();

  let drawn = $state<SVGSVGElement | null>(null);
  let menu = $state<{ at: MenuPoint | null } | null>(null);

  const name = $derived((drawn && nameOf(drawn)) ?? t("DRAWING"));
  const source = $derived<DrawingSource>({ svg: () => svg, server: server(), folder: folder() });

  const open = () => openFilePreview({ url: "", name, kind: "drawing", drawing: source, onDelete: null });

  const actions = $derived<FileActionEntry[]>([
    { id: "view", run: open },
    ...drawingActions(() => drawn, name, source),
  ]);
</script>

<div use:gridHeight class="flex w-full justify-center select-none">
  <div
    class="relative flex items-center justify-center overflow-hidden {MEDIA_FRAME_CLASS} bg-card"
    style:width="min(100%, {size})"
    style:aspect-ratio="1"
  >
    <button
      type="button"
      onclick={open}
      oncontextmenu={(event) => {
        event.preventDefault();
        menu = { at: menuPointOf(event) };
      }}
      aria-label={name}
      class="flex size-full cursor-pointer items-center justify-center"
    >
      <DrawingView {svg} bind:drawn class="size-full *:size-full" />
    </button>
  </div>
</div>

{#if menu?.at}
  <PopupMenu open onOpenChange={(value) => !value && (menu = null)} anchor={menu.at} label={name}>
    <FileActionItems {actions} />
  </PopupMenu>
{:else if menu}
  <SharedLinkActionsDialog filename={name} {actions} onDismiss={() => (menu = null)} />
{/if}
