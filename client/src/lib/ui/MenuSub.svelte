<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import type { IconSource } from "./icons";
  import { menuDrill } from "./menuDrill.svelte";
  import {
    MENU_ICON_SIZE,
    MENU_ITEM_CLASS,
    MENU_PADDING,
    MENU_SCROLL_CLASS,
    SUBMENU_CONTENT_CLASS,
    menuIconClass,
  } from "./menuSurface";
  import { returnFocus } from "./keepFocus";
  import { viewportScrollbar } from "./scrollbar";

  interface Props {
    text: string;
    value?: string;
    icon?: IconSource;
    leading?: Snippet;
    children: Snippet;
  }

  const { text, value, icon: IconComponent, leading, children }: Props = $props();

  const drill = isTouch ? menuDrill() : undefined;
</script>

{#snippet face()}
  {#if IconComponent}
    <IconComponent size={MENU_ICON_SIZE} class={menuIconClass()} />
  {/if}
  {@render leading?.()}
  <span class="min-w-0 flex-1 truncate text-body-md">{text}</span>
  {#if value}
    <span class="shrink-0 pl-4 text-caption text-faint">{value}</span>
  {/if}
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
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent
        align="start"
        sideOffset={4}
        alignOffset={-MENU_PADDING}
        collisionPadding={layout.menuPadding}
        avoidCollisions={true}
        class={SUBMENU_CONTENT_CLASS}
      >
        <div class={MENU_SCROLL_CLASS} use:viewportScrollbar>{@render children()}</div>
      </DropdownMenu.SubContent>
    </DropdownMenu.Portal>
  </DropdownMenu.Sub>
{/if}
