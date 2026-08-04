<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    value: string;
    oninput: (value: string) => void;
    label?: string;
    placeholder?: string;
    secret?: boolean;
    singleLine?: boolean;
    minLines?: number;
    autofocus?: boolean;
    onkeydown?: (event: KeyboardEvent) => void;
    class?: string;
    trailing?: Snippet;
  }

  const {
    value,
    oninput,
    label,
    placeholder,
    secret = false,
    singleLine = false,
    minLines = 1,
    autofocus = false,
    onkeydown,
    class: className = "",
    trailing,
  }: Props = $props();

  const FIELD_CLASS =
    "min-w-0 flex-1 bg-transparent text-body-md caret-accent outline-none placeholder:text-on-surface-variant";

  let field = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const handle = (event: Event) => oninput((event.currentTarget as HTMLInputElement).value);

  $effect(() => {
    if (autofocus) field?.focus();
  });
</script>

<div class={className}>
  {#if label}
    <p class="mb-1.5 text-label-lg">{label}</p>
  {/if}
  <div
    class="flex w-full items-center gap-2 rounded-sm border border-outline-variant px-3 py-2 transition-colors focus-within:border-accent"
  >
    {#if singleLine}
      <input
        bind:this={field}
        type={secret ? "password" : "text"}
        {value}
        {placeholder}
        {onkeydown}
        oninput={handle}
        class={FIELD_CLASS}
      />
    {:else}
      <textarea
        bind:this={field}
        {value}
        {placeholder}
        {onkeydown}
        rows={minLines}
        oninput={handle}
        class="{FIELD_CLASS} field-auto no-scrollbar max-h-80 resize-y"
      ></textarea>
    {/if}
    {@render trailing?.()}
  </div>
</div>
