<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import type { IconSource } from "./icons";
  import { menuDrill } from "./menuDrill.svelte";
  import { MENU_ICON_SIZE, MENU_ITEM_CLASS, MENU_PADDING, SUBMENU_CONTENT_CLASS, menuIconClass } from "./menuSurface";
  import { returnFocus } from "./keepFocus";

  interface Props {
    text: string;
    icon?: IconSource;
    leading?: Snippet;
    children: Snippet;
  }

  const { text, icon: IconComponent, leading, children }: Props = $props();

  const drill = isTouch ? menuDrill() : undefined;
</script>

{#snippet face()}
  {#if IconComponent}
    <IconComponent size={MENU_ICON_SIZE} class={menuIconClass()} />
  {/if}
  {@render leading?.()}
  <span class="min-w-0 flex-1 truncate text-body-md">{text}</span>
  <ChevronRight size={MENU_ICON_SIZE} class={menuIconClass()} />
{/snippet}

{#if drill}
  <DropdownMenu.Item
    closeOnSelect={false}
    onSelect={() => drill.open(text, children)}
    onfocusin={returnFocus}
    class={MENU_ITEM_CLASS}
  >
    {@render face()}
  </DropdownMenu.Item>
{:else}
  <DropdownMenu.Sub>
    <DropdownMenu.SubTrigger onfocusin={returnFocus} class={MENU_ITEM_CLASS}>
      {@render face()}
    </DropdownMenu.SubTrigger>
    <DropdownMenu.SubContent
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
{/if}
