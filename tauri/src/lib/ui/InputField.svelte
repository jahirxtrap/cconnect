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

  let field = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const handle = (event: Event) => oninput((event.currentTarget as HTMLInputElement).value);

  $effect(() => {
    if (autofocus) field?.focus();
  });
</script>

<div class={className}>
  {#if label}
    <p class="mb-1 text-label-md text-on-surface-variant">{label}</p>
  {/if}
  <div
    class="flex w-full items-center rounded-xs border border-outline-variant px-3 py-2.5 focus-within:border-accent"
  >
    {#if singleLine}
      <input
        bind:this={field}
        type={secret ? "password" : "text"}
        {value}
        {placeholder}
        {onkeydown}
        oninput={handle}
        class="min-w-0 flex-1 bg-transparent text-body-md caret-accent outline-none placeholder:text-on-surface-variant"
      />
    {:else}
      <textarea
        bind:this={field}
        {value}
        {placeholder}
        {onkeydown}
        rows={minLines}
        oninput={handle}
        class="min-w-0 flex-1 resize-none bg-transparent text-body-md caret-accent outline-none placeholder:text-on-surface-variant"
      ></textarea>
    {/if}
    {#if trailing}
      <div class="ml-2 shrink-0">{@render trailing()}</div>
    {/if}
  </div>
</div>
