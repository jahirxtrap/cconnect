<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import X from "@lucide/svelte/icons/x";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";

  interface Props {
    value: string;
    oninput: (value: string) => void;
    label?: string;
    required?: boolean;
    placeholder?: string;
    secret?: boolean;
    singleLine?: boolean;
    minLines?: number;
    maxLines?: number;
    autofocus?: boolean;
    numeric?: boolean;
    error?: string | null;
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
    required = false,
    placeholder,
    secret = false,
    singleLine = false,
    minLines = 1,
    maxLines,
    autofocus = false,
    numeric = false,
    error = null,
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
    <p class="mb-1.5 text-label-lg">
      {label}{#if required}<span class="text-error">&nbsp;*</span>{/if}
    </p>
  {/if}
  <div
    class="flex w-full items-center gap-2 rounded-md border-2 px-3 py-2 transition-colors {error
      ? 'border-error'
      : 'border-outline-variant focus-within:border-accent'}"
  >
    {#if singleLine}
      <input
        bind:this={field}
        type={secret && !revealed ? "password" : "text"}
        inputmode={numeric ? "decimal" : undefined}
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
      <TooltipIconButton
        label={t("CANCEL")}
        tooltip={false}
        onclick={() => onClear?.()}
        class="size-6 [&_svg]:size-[18px]"
      >
        <X size={18} class="text-on-surface-variant" />
      </TooltipIconButton>
    {/if}
    {#if secret}
      <TooltipIconButton
        label={t(revealed ? "HIDE" : "SHOW")}
        tooltip={false}
        onclick={() => (revealed = !revealed)}
        class="size-6 [&_svg]:size-[18px]"
      >
        {#if revealed}
          <EyeOff size={18} class="text-on-surface-variant" />
        {:else}
          <Eye size={18} class="text-on-surface-variant" />
        {/if}
      </TooltipIconButton>
    {/if}
    {@render trailing?.()}
  </div>
  {#if error}
    <p class="mt-1 text-body-sm text-error">{error}</p>
  {/if}
</div>
