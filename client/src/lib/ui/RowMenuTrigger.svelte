<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { holdFocus } from "./keepFocus";
  import { ROW_MENU_TRIGGER_CLASS, rowMenuReveal } from "./RowMenu.svelte";

  interface Props {
    open: boolean;
    onOpen: (anchor: HTMLElement) => void;
    onClose: () => void;
    shown?: boolean;
  }

  const { open, onOpen, onClose, shown = false }: Props = $props();

  let button = $state<HTMLButtonElement | null>(null);

  const toggle = () => {
    if (open) onClose();
    else if (button) onOpen(button);
  };

  const onpointerdown = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.ctrlKey) return;
    const opening = !open;
    toggle();
    if (opening) event.preventDefault();
  };

  const onpointerup = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    event.preventDefault();
    toggle();
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggle();
    } else if (event.key === "ArrowDown" && !open && button) {
      event.preventDefault();
      onOpen(button);
    }
  };

  $effect(() => () => {
    if (untrack(() => open)) onClose();
  });
</script>

<div class="flex {rowMenuReveal(shown || open)}">
  <button
    bind:this={button}
    type="button"
    aria-label={t("MORE_OPTIONS")}
    aria-haspopup="menu"
    aria-expanded={open}
    data-state={open ? "open" : "closed"}
    class={ROW_MENU_TRIGGER_CLASS}
    onmousedown={holdFocus}
    {onpointerdown}
    {onpointerup}
    {onkeydown}
    oncontextmenu={(event) => event.preventDefault()}
  >
    <EllipsisVertical size={16} />
  </button>
</div>
