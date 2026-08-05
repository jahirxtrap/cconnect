<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { Snippet } from "svelte";
  import { keyboardNavigation } from "./keyboardNavigation.svelte";

  interface Props {
    label: string;
    onclick: () => void;
    enabled?: boolean;
    class?: string;
    children: Snippet;
  }

  const { label, onclick, enabled = true, class: className = "", children }: Props = $props();

  const BASE_CLASS =
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors enabled:hover:bg-on-surface/8 disabled:cursor-default disabled:opacity-40";
  const LONG_PRESS_MS = 500;

  const SIZE_CLASS = /(^|\s)size-\S+/;

  const compact = $derived(/(^|\s)size-8(\s|$)/.test(className));

  const TRIGGER_CLASS = $derived(
    `${BASE_CLASS} ${SIZE_CLASS.test(className) ? "" : "size-10"} ${compact ? "[&_svg]:size-[18px]" : "[&_svg]:size-6"} ${className}`,
  );

  let open = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let longPressed = false;

  let lastX = Number.NaN;
  let lastY = Number.NaN;

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

  const pressStart = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || !enabled) return;
    longPressed = false;
    timer = setTimeout(() => {
      longPressed = true;
      open = true;
    }, LONG_PRESS_MS);
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
    onclick();
  };
</script>

<Tooltip.Provider>
  <Tooltip.Root {open} onOpenChange={(value) => !value && hide()}>
    <Tooltip.Trigger
      disabled={!enabled}
      aria-label={label}
      onclick={activate}
      onpointermove={show}
      onpointerleave={leave}
      onpointerdown={pressStart}
      onpointerup={pressEnd}
      onpointercancel={hide}
      onfocus={onFocus}
      onblur={hide}
      class={TRIGGER_CLASS}
    >
      {@render children()}
    </Tooltip.Trigger>
    {#if open}
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={4} class="z-50 rounded-sm bg-surface-variant px-2 py-1 text-body-sm shadow-lg">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    {/if}
  </Tooltip.Root>
</Tooltip.Provider>
