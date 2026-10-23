<script module lang="ts">
  export const HEADER_SEARCH_CLASS = "w-80";
</script>

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

  $effect(() => {
    if (autofocus) field?.focus();
  });
</script>

<div
  class="flex {large ? 'h-9' : 'h-8'} min-w-0 items-center gap-2 rounded-md bg-surface-variant pr-1 pl-2.5 {className}"
>
  <Search size={16} class="shrink-0 text-faint" />
  <input
    bind:this={field}
    {value}
    {placeholder}
    {onkeydown}
    oninput={(event) => oninput((event.currentTarget as HTMLInputElement).value)}
    class="min-w-0 flex-1 bg-transparent text-body-md caret-accent outline-none placeholder:text-faint"
  />
  <span class="flex" class:invisible={!clears && !onClose}>
    <TooltipIconButton
      label={t(clears ? "CANCEL" : "CLOSE")}
      tooltip={false}
      enabled={clears || onClose !== null}
      class="size-6"
      onclick={() => (clears ? oninput("") : onClose?.())}
    >
      <X />
    </TooltipIconButton>
  </span>
</div>
