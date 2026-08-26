<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { MENU_PADDING, SUBMENU_CONTENT_CLASS } from "$lib/ui/menuSurface";

  interface Props {
    text: string;
    leading?: Snippet;
    children: Snippet;
  }

  const { text, leading, children }: Props = $props();

  let content = $state<HTMLElement | null>(null);

  $effect(() => {
    const node = content;
    if (!node) return;
    const edge = layout.menuPadding.left;
    const placer = node.parentElement;
    let applied = 0;
    const adjust = () => {
      const left = node.getBoundingClientRect().left - applied;
      const next = Math.max(0, edge - left);
      if (next === applied) return;
      applied = next;
      node.style.marginLeft = next ? `${next}px` : "";
    };
    adjust();
    const placed = placer ? new MutationObserver(adjust) : null;
    placed?.observe(placer as HTMLElement, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", adjust);
    return () => {
      placed?.disconnect();
      window.removeEventListener("resize", adjust);
    };
  });
</script>

<DropdownMenu.Sub>
  <DropdownMenu.SubTrigger
    class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors outline-none select-none data-highlighted:bg-on-surface/10"
  >
    {@render leading?.()}
    <span class="min-w-0 flex-1 truncate text-body-md">{text}</span>
    <ChevronRight size={16} class="shrink-0 text-on-surface-variant" />
  </DropdownMenu.SubTrigger>
  <DropdownMenu.SubContent
    bind:ref={content}
    align="start"
    sideOffset={4}
    alignOffset={-MENU_PADDING}
    collisionPadding={layout.menuPadding}
    avoidCollisions={true}
    class={SUBMENU_CONTENT_CLASS}
  >
    {@render children()}
  </DropdownMenu.SubContent>
</DropdownMenu.Sub>
