<script lang="ts">
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    side?: "top" | "bottom";
    align?: "start" | "center" | "end";
    matchTriggerWidth?: boolean;
    trigger: Snippet;
    children: Snippet;
  }

  const {
    open,
    onOpenChange,
    side = "bottom",
    align = "start",
    matchTriggerWidth = false,
    trigger,
    children,
  }: Props = $props();
</script>

<DropdownMenu.Root {open} {onOpenChange}>
  <DropdownMenu.Trigger>
    {@render trigger()}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      {side}
      {align}
      sideOffset={4}
      style={matchTriggerWidth ? "min-width: var(--bits-dropdown-menu-anchor-width)" : ""}
      class="z-50 max-h-(--bits-dropdown-menu-content-available-height) overflow-y-auto rounded-xs bg-surface-variant py-2 shadow-xl"
    >
      {@render children()}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
