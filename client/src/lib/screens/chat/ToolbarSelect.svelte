<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconSource } from "$lib/ui/icons";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipWrap from "$lib/ui/TooltipWrap.svelte";
  import { CHIP_ICON_SIZE, CHIP_ITEM_CLASS, CHIP_SLOT, chipToggleClass } from "./toolbarChips";

  interface Props {
    label: string;
    icon: IconSource;
    iconClass?: string;
    text?: string;
    children: Snippet;
  }

  const { label, icon: Icon, iconClass = "text-accent", text, children }: Props = $props();

  let open = $state(false);
</script>

<PopupMenu {open} side="top" triggerClass={CHIP_SLOT} onOpenChange={(value) => (open = value)}>
  {#snippet trigger()}
    <TooltipWrap {label} class={CHIP_SLOT}>
      <span class={text === undefined ? chipToggleClass(false) : CHIP_ITEM_CLASS}>
        <Icon size={CHIP_ICON_SIZE} class="shrink-0 {iconClass}" />
        {#if text !== undefined}
          <span class="whitespace-nowrap">{text}</span>
        {/if}
      </span>
    </TooltipWrap>
  {/snippet}
  {@render children()}
</PopupMenu>
