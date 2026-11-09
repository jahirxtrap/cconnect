<script module lang="ts">
  import { isTouch } from "$lib/platform";

  export const ROW_MENU_TRIGGER_CLASS =
    "inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-hover hover:text-on-surface";

  export const rowMenuReveal = (visible: boolean) => (isTouch || visible ? "" : "opacity-0 group-hover:opacity-100");
</script>

<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import PopupMenu from "./PopupMenu.svelte";

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shown?: boolean;
    children: Snippet;
  }

  const { open, onOpenChange, shown = false, children }: Props = $props();
</script>

<div class="flex {rowMenuReveal(shown || open)}">
  <PopupMenu {open} label={t("MORE_OPTIONS")} triggerClass={ROW_MENU_TRIGGER_CLASS} {onOpenChange}>
    {#snippet trigger()}
      <EllipsisVertical size={16} />
    {/snippet}
    {@render children()}
  </PopupMenu>
</div>
