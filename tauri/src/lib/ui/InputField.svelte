<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";

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
  let revealed = $state(false);

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
        type={secret && !revealed ? "password" : "text"}
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
    {#if secret}
      <button
        type="button"
        onclick={() => (revealed = !revealed)}
        aria-label={t(revealed ? "HIDE" : "SHOW")}
        class="shrink-0 cursor-pointer text-on-surface-variant transition-colors hover:text-on-surface"
      >
        {#if revealed}
          <EyeOff size={20} />
        {:else}
          <Eye size={20} />
        {/if}
      </button>
    {/if}
    {@render trailing?.()}
  </div>
</div>
