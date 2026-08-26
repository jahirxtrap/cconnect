<script lang="ts">
  import { DropdownMenu } from "bits-ui";
  import { holdFocus } from "./keepFocus";
  import type { Snippet } from "svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import MenuScrim from "./MenuScrim.svelte";
  import { MENU_CONTENT_CLASS } from "$lib/ui/menuSurface";

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    label?: string;
    side?: "top" | "bottom";
    align?: "start" | "center" | "end";
    matchTriggerWidth?: boolean;
    triggerClass?: string;
    trigger?: Snippet;
    triggerChild?: Snippet<[Record<string, unknown>]>;
    children: Snippet;
  }

  const {
    open,
    onOpenChange,
    label,
    side = "bottom",
    align = "start",
    matchTriggerWidth = false,
    triggerClass = "",
    trigger,
    triggerChild,
    children,
  }: Props = $props();
</script>

<MenuScrim {open} onDismiss={() => onOpenChange(false)} />

<DropdownMenu.Root {open} {onOpenChange}>
  {#if triggerChild}
    <DropdownMenu.Trigger onmousedown={holdFocus}>
      {#snippet child({ props })}
        {@render triggerChild(props)}
      {/snippet}
    </DropdownMenu.Trigger>
  {:else}
    <DropdownMenu.Trigger onmousedown={holdFocus} class={triggerClass} aria-label={label}>
      {@render trigger?.()}
    </DropdownMenu.Trigger>
  {/if}
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      {side}
      {align}
      sideOffset={4}
      collisionPadding={layout.menuPadding}
      style={matchTriggerWidth ? "min-width: var(--bits-dropdown-menu-anchor-width)" : ""}
      class={MENU_CONTENT_CLASS}
    >
      {@render children()}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
