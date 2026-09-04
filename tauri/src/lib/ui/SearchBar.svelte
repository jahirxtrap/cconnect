<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Props {
    value: string;
    oninput: (value: string) => void;
    placeholder: string;
    autofocus?: boolean;
    large?: boolean;
    onkeydown?: (event: KeyboardEvent) => void;
    onClose?: (() => void) | null;
    class?: string;
  }

  const {
    value,
    oninput,
    placeholder,
    autofocus = false,
    large = false,
    onkeydown,
    onClose = null,
    class: className = "",
  }: Props = $props();

  let field = $state<HTMLInputElement | null>(null);

  const clears = $derived(value.length > 0);
  const slotClass = $derived(large ? "size-8" : "size-7");

  $effect(() => {
    if (autofocus) field?.focus();
  });
</script>

<div
  class="flex {large
    ? 'h-10'
    : 'h-9'} min-w-0 items-center rounded-md bg-surface-variant/60 px-1 {className}"
>
  <span
    class="inline-flex {slotClass} shrink-0 items-center justify-center text-on-surface-variant"
  >
    <Search size={18} />
  </span>
  <input
    bind:this={field}
    {value}
    {placeholder}
    {onkeydown}
    oninput={(event) => oninput((event.currentTarget as HTMLInputElement).value)}
    class="min-w-0 flex-1 bg-transparent px-1 text-body-md caret-accent outline-none placeholder:text-on-surface-variant"
  />
  <span class="flex" class:invisible={!clears && !onClose}>
    <TooltipIconButton
      label={t(clears ? "CANCEL" : "CLOSE")}
      tooltip={false}
      enabled={clears || onClose !== null}
      class="{slotClass} [&_svg]:size-[18px]"
      onclick={() => (clears ? oninput("") : onClose?.())}
    >
      <X class="text-on-surface-variant" />
    </TooltipIconButton>
  </span>
</div>
