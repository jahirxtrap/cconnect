<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import { DropdownMenu } from "bits-ui";
  import { holdFocus } from "./keepFocus";
  import type { Snippet } from "svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import MenuScrim from "./MenuScrim.svelte";
  import { provideMenuDrill } from "./menuDrill.svelte";
  import {
    MENU_CONTENT_CLASS,
    MENU_FOOT_CLASS,
    MENU_HEAD_CLASS,
    MENU_ICON_SIZE,
    MENU_ITEM_CLASS,
    MENU_SCROLL_CLASS,
    menuIconClass,
    type MenuPoint,
  } from "$lib/ui/menuSurface";
  import { viewportScrollbar } from "$lib/ui/scrollbar";

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    label?: string;
    side?: "top" | "bottom";
    align?: "start" | "center" | "end";
    matchTriggerWidth?: boolean;
    anchor?: MenuPoint | HTMLElement | null;
    triggerClass?: string;
    trigger?: Snippet;
    triggerChild?: Snippet<[Record<string, unknown>]>;
    header?: Snippet;
    footer?: Snippet;
    children: Snippet;
  }

  const {
    open,
    onOpenChange,
    label,
    side = "bottom",
    align = "start",
    matchTriggerWidth = false,
    anchor = null,
    triggerClass = "",
    trigger,
    triggerChild,
    header,
    footer,
    children,
  }: Props = $props();

  const atPoint = $derived(anchor !== null && !(anchor instanceof HTMLElement));

  const customAnchor = $derived(
    anchor instanceof HTMLElement
      ? anchor
      : anchor
        ? { getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0) }
        : null,
  );

  const drill = provideMenuDrill();

  $effect(() => {
    if (!open) drill.release();
  });

  $effect(() => () => drill.reset());
</script>

{#snippet body()}
  {#if drill.current}
    {@const level = drill.current}
    <DropdownMenu.Item closeOnSelect={false} onSelect={() => drill.back()} class={MENU_ITEM_CLASS}>
      <ChevronLeft size={MENU_ICON_SIZE} class={menuIconClass()} />
      <span class="min-w-0 flex-1 truncate text-body-md text-on-surface-variant">{level.text}</span>
    </DropdownMenu.Item>
    {@render level.children()}
  {:else}
    {@render children()}
  {/if}
{/snippet}

<MenuScrim {open} onDismiss={() => onOpenChange(false)} />

<DropdownMenu.Root {open} {onOpenChange} onOpenChangeComplete={(next) => !next && drill.reset()}>
  {#if triggerChild}
    <DropdownMenu.Trigger onmousedown={holdFocus} oncontextmenu={(event) => event.preventDefault()}>
      {#snippet child({ props })}
        {@render triggerChild(props)}
      {/snippet}
    </DropdownMenu.Trigger>
  {:else if !customAnchor}
    <DropdownMenu.Trigger
      onmousedown={holdFocus}
      oncontextmenu={(event) => event.preventDefault()}
      class={triggerClass}
      aria-label={label}
    >
      {@render trigger?.()}
    </DropdownMenu.Trigger>
  {/if}
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      {side}
      {align}
      {customAnchor}
      sideOffset={atPoint ? 0 : 4}
      collisionPadding={layout.menuPadding}
      style={matchTriggerWidth ? "min-width: var(--bits-dropdown-menu-anchor-width)" : ""}
      class={MENU_CONTENT_CLASS}
    >
      {#if header}
        <div class={MENU_HEAD_CLASS}>{@render header()}</div>
      {/if}
      <div class={MENU_SCROLL_CLASS} use:viewportScrollbar>{@render body()}</div>
      {#if drill.current ? drill.current.footer : footer}
        {@const pinned = drill.current ? drill.current.footer : footer}
        <div class={MENU_FOOT_CLASS}>{@render pinned?.()}</div>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
