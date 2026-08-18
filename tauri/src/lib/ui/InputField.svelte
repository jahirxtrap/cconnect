<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import X from "@lucide/svelte/icons/x";
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
    maxLines?: number;
    autofocus?: boolean;
    onClear?: (() => void) | null;
    clearAlways?: boolean;
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
    maxLines,
    autofocus = false,
    onClear = null,
    clearAlways = false,
    onkeydown,
    class: className = "",
    trailing,
  }: Props = $props();

  const LINE_HEIGHT = 20;

  const showClear = $derived(onClear !== null && (clearAlways || value.length > 0));

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
    class="flex w-full items-center gap-2 rounded-md border border-outline-variant px-3 py-2 transition-colors focus-within:border-accent"
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
        style="min-height: {minLines * LINE_HEIGHT}px{maxLines
          ? `; max-height: ${maxLines * LINE_HEIGHT}px`
          : ''}"
        class="{FIELD_CLASS} field-auto no-scrollbar resize-none {maxLines ? '' : 'max-h-80'}"
      ></textarea>
    {/if}
    {#if showClear}
      <button
        type="button"
        onclick={() => onClear?.()}
        aria-label={t("CANCEL")}
        class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
      >
        <X size={16} />
      </button>
    {/if}
    {#if secret}
      <button
        type="button"
        onclick={() => (revealed = !revealed)}
        aria-label={t(revealed ? "HIDE" : "SHOW")}
        class="shrink-0 cursor-pointer text-on-surface-variant transition-colors hover:text-on-surface"
      >
        {#if revealed}
          <EyeOff size={24} />
        {:else}
          <Eye size={24} />
        {/if}
      </button>
    {/if}
    {@render trailing?.()}
  </div>
</div>
