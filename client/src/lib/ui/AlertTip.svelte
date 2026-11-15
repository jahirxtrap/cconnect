<script lang="ts">
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import { Tooltip } from "bits-ui";
  import { isTouch } from "$lib/platform";
  import { holdFocus, keepFocus } from "./keepFocus";
  import { TOOLTIP_CLASS } from "./menuSurface";
  import TouchTip from "./TouchTip.svelte";

  interface Props {
    label: string;
    text: string;
    onSeen?: (() => void) | null;
  }

  const { label, text, onSeen = null }: Props = $props();

  const TOUCH_HIDE_MS = 2500;
  const HALF = 2;
  const ICON_SIZE = 18;
  const BUTTON_CLASS =
    "no-callout inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-red hover:bg-hover";
  const TEXT_CLASS = "max-w-80 whitespace-pre-line";

  let touchTip = $state<{ x: number; top: number; bottom: number } | null>(null);
  let trigger = $state<HTMLElement | null>(null);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let open = $state(false);

  const hide = () => {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
    if (touchTip === null) return;
    touchTip = null;
    onSeen?.();
  };

  const toggle = (event: MouseEvent) => {
    if (touchTip !== null) {
      hide();
      return;
    }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    touchTip = { x: box.left + box.width / HALF, top: box.top, bottom: box.bottom };
    hideTimer = setTimeout(hide, TOUCH_HIDE_MS);
  };

  const onOpenChange = (value: boolean) => {
    open = value;
    if (!value) onSeen?.();
  };
</script>

{#if isTouch}
  <button bind:this={trigger} type="button" use:keepFocus onclick={toggle} aria-label={label} class={BUTTON_CLASS}>
    <CircleAlert size={ICON_SIZE} />
  </button>
  <TouchTip anchor={touchTip} within={trigger} onDismiss={hide}>
    <span class={TEXT_CLASS}>{text}</span>
  </TouchTip>
{:else}
  <Tooltip.Provider>
    <Tooltip.Root delayDuration={0} {open} {onOpenChange}>
      <Tooltip.Trigger onmousedown={holdFocus} aria-label={label} class={BUTTON_CLASS}>
        <CircleAlert size={ICON_SIZE} />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={4} class="z-75 {TOOLTIP_CLASS} {TEXT_CLASS}">
          {text}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
