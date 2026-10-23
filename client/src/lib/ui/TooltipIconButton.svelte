<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";
  import { shortcuts } from "$lib/platform/shortcuts.svelte";
  import { keyboardNavigation } from "./keyboardNavigation.svelte";
  import { TOOLTIP_CLASS } from "./menuSurface";
  import { LONG_PRESS_MS } from "./press";
  import TouchTip from "./TouchTip.svelte";

  interface Props {
    label: string;
    shortcut?: string;
    onclick?: () => void;
    enabled?: boolean;
    tooltip?: boolean;
    active?: boolean;
    selected?: boolean;
    class?: string;
    children: Snippet;
    [key: string]: unknown;
  }

  const {
    label,
    shortcut,
    onclick,
    enabled = true,
    tooltip = true,
    active = false,
    selected = false,
    class: className = "",
    children,
    ...rest
  }: Props = $props();

  const BASE_CLASS =
    "no-callout inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full transition-colors select-none disabled:cursor-default disabled:opacity-40";
  const ACTIVE_CLASS = "text-accent enabled:hover:bg-hover";
  const SELECTED_CLASS = "bg-surface-variant text-accent";
  const IDLE_CLASS = "text-on-surface-variant enabled:hover:bg-hover enabled:hover:text-on-surface";
  const PRESS_SLOP = 10;
  const TOUCH_HIDE_MS = 1500;
  const HALF = 2;

  const SIZE_CLASS = /(^|\s)(size|w|h)-\S+/;
  const ICON_SIZE_CLASS = /\[&_svg\]:size-/;
  const SMALL_CLASS = /(^|\s)size-[67](\s|$)/;
  const DEFAULT_SIZE = "size-8";

  const iconSize = $derived(
    ICON_SIZE_CLASS.test(className) ? "" : SMALL_CLASS.test(className) ? "[&_svg]:size-4" : "[&_svg]:size-4.5",
  );

  const TRIGGER_CLASS = $derived(
    `${BASE_CLASS} ${selected ? SELECTED_CLASS : active ? ACTIVE_CLASS : IDLE_CLASS} ${SIZE_CLASS.test(className) ? "" : DEFAULT_SIZE} ${iconSize} ${className}`,
  );

  const hint = $derived(shortcut ? shortcuts.hint(shortcut) : "");
  const keyshortcuts = $derived(shortcut ? shortcuts.aria(shortcut) : undefined);

  let open = $state(false);
  let touchTip = $state<{ x: number; top: number; bottom: number } | null>(null);
  let trigger = $state<HTMLElement | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressed = false;

  let lastX = Number.NaN;
  let lastY = Number.NaN;
  let startX = 0;
  let startY = 0;

  const onFocus = (event: FocusEvent) => {
    const target = event.currentTarget as HTMLElement;
    hide();
    if (!keyboardNavigation.value) target.blur();
  };

  const hide = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    open = false;
  };

  const hideTouchTip = () => {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
    touchTip = null;
  };

  const leave = () => {
    lastX = Number.NaN;
    lastY = Number.NaN;
    hide();
  };

  const show = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const moved = event.clientX !== lastX || event.clientY !== lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (moved) open = true;
  };

  const pressStart = (event: TouchEvent) => {
    if (!enabled) return;
    const touch = event.touches[0];
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    startX = touch.clientX;
    startY = touch.clientY;
    longPressed = false;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      longPressed = true;
      touchTip = { x: box.left + box.width / HALF, top: box.top, bottom: box.bottom };
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = setTimeout(hideTouchTip, TOUCH_HIDE_MS);
    }, LONG_PRESS_MS);
  };

  const pressMove = (event: TouchEvent) => {
    if (timer === null) return;
    const touch = event.touches[0];
    if (Math.abs(touch.clientX - startX) > PRESS_SLOP || Math.abs(touch.clientY - startY) > PRESS_SLOP) pressEnd();
  };

  const pressEnd = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const activate = (event: MouseEvent) => {
    event.stopPropagation();
    pressEnd();
    if (longPressed) {
      longPressed = false;
      return;
    }
    hide();
    onclick?.();
  };

</script>

{#if !tooltip}
  <button
    type="button"
    disabled={!enabled}
    aria-label={label}
    aria-keyshortcuts={keyshortcuts}
    onclick={activate}
    class={TRIGGER_CLASS}
    {...rest}
  >
    {@render children()}
  </button>
{:else if isTouch}
  <button
    bind:this={trigger}
    type="button"
    disabled={!enabled}
    aria-label={label}
    aria-keyshortcuts={keyshortcuts}
    onclick={activate}
    ontouchstart={pressStart}
    ontouchmove={pressMove}
    ontouchend={pressEnd}
    ontouchcancel={pressEnd}
    oncontextmenu={(event) => event.preventDefault()}
    class={TRIGGER_CLASS}
    {...rest}
  >
    {@render children()}
  </button>
  <TouchTip text={label} anchor={touchTip} within={trigger} onDismiss={hideTouchTip} />
{:else}
  <Tooltip.Provider>
    <Tooltip.Root {open} onOpenChange={(value) => !value && hide()}>
      <Tooltip.Trigger
        disabled={!enabled}
        aria-label={label}
        aria-keyshortcuts={keyshortcuts}
        onclick={activate}
        onpointermove={show}
        onpointerleave={leave}
        onfocus={onFocus}
        onblur={hide}
        class={TRIGGER_CLASS}
        {...rest}
      >
        {@render children()}
      </Tooltip.Trigger>
      {#if open}
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={4}
            class="z-75 flex items-center gap-1.5 {TOOLTIP_CLASS}"
          >
            <span>{label}</span>
            {#if hint}
              <span class="text-caption text-faint">{hint}</span>
            {/if}
          </Tooltip.Content>
        </Tooltip.Portal>
      {/if}
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
