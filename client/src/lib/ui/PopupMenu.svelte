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
    MENU_ICON_SIZE,
    MENU_ITEM_CLASS,
    MENU_PANEL_BODY_CLASS,
    MENU_PANEL_CLASS,
    MENU_PANEL_HEAD_CLASS,
    menuIconClass,
  } from "$lib/ui/menuSurface";

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    label?: string;
    side?: "top" | "bottom";
    align?: "start" | "center" | "end";
    matchTriggerWidth?: boolean;
    triggerClass?: string;
    contentClass?: string;
    trigger?: Snippet;
    triggerChild?: Snippet<[Record<string, unknown>]>;
    header?: Snippet;
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
    contentClass = "",
    trigger,
    triggerChild,
    header,
    children,
  }: Props = $props();

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
  {:else}
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
      sideOffset={4}
      collisionPadding={layout.menuPadding}
      style={matchTriggerWidth ? "min-width: var(--bits-dropdown-menu-anchor-width)" : ""}
      class="{header ? MENU_PANEL_CLASS : MENU_CONTENT_CLASS} {contentClass}"
    >
      {#if header}
        <div class={MENU_PANEL_HEAD_CLASS}>{@render header()}</div>
        <div class={MENU_PANEL_BODY_CLASS}>{@render body()}</div>
      {:else}
        {@render body()}
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
