<script lang="ts">
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    side?: "top" | "bottom";
    align?: "start" | "center" | "end";
    matchTriggerWidth?: boolean;
    triggerClass?: string;
    trigger: Snippet;
    children: Snippet;
  }

  const {
    open,
    onOpenChange,
    side = "bottom",
    align = "start",
    matchTriggerWidth = false,
    triggerClass = "",
    trigger,
    children,
  }: Props = $props();
</script>

<DropdownMenu.Root {open} {onOpenChange}>
  <DropdownMenu.Trigger class={triggerClass}>
    {@render trigger()}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      {side}
      {align}
      sideOffset={4}
      collisionPadding={8}
      style={matchTriggerWidth ? "min-width: var(--bits-dropdown-menu-anchor-width)" : ""}
      class="menu-surface scrollbar-thin z-50 max-h-(--bits-dropdown-menu-content-available-height) max-w-[calc(100vw-1rem)] min-w-40 overflow-y-auto rounded-md border border-outline-variant bg-surface-variant p-1 shadow-lg"
    >
      {@render children()}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
