<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import X from "@lucide/svelte/icons/x";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";
  import { t } from "$lib/i18n/index.svelte";
  import ErrorText from "./ErrorText.svelte";
  import { FIELD_ACTIONS_CLASS, FIELD_ACTIONS_GAP, FIELD_BOX_CLASS, FIELD_INPUT_CLASS, FIELD_LABEL_CLASS } from "./field";

  interface Props {
    value: string;
    oninput: (value: string) => void;
    label?: string;
    required?: boolean;
    optional?: boolean;
    placeholder?: string;
    secret?: boolean;
    singleLine?: boolean;
    minLines?: number;
    maxLines?: number;
    autofocus?: boolean;
    numeric?: boolean;
    url?: boolean;
    enterKeyHint?: HTMLInputAttributes["enterkeyhint"];
    enabled?: boolean;
    readonly?: boolean;
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
    optional = false,
    placeholder,
    secret = false,
    singleLine = false,
    minLines = 1,
    maxLines,
    autofocus = false,
    numeric = false,
    url = false,
    enterKeyHint,
    enabled = true,
    readonly = false,
    error = null,
    onClear = null,
    clearAlways = false,
    onkeydown,
    class: className = "",
    trailing,
  }: Props = $props();

  const LINE_HEIGHT = 20;

  const showClear = $derived(onClear !== null && (clearAlways || value.length > 0));


  let field = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);
  let actionsWidth = $state(0);

  const actionsReserve = $derived(
    actionsWidth ? `margin-right: ${actionsWidth + FIELD_ACTIONS_GAP}px` : "",
  );
  let revealed = $state(false);

  const masked = $derived(secret && !revealed);

  const handle = (event: Event) => oninput((event.currentTarget as HTMLInputElement).value);

  $effect(() => {
    if (autofocus) field?.focus();
  });
</script>

<div class="{enabled ? '' : 'opacity-40'} {className}">
  {#if label}
    <p class={FIELD_LABEL_CLASS}>
      {optional ? t("OPTIONAL_LABEL", label) : label}{#if required}<span class="text-error">&nbsp;*</span>{/if}
    </p>
  {/if}
  <div
    class="{FIELD_BOX_CLASS} {error
      ? 'ring-error'
      : 'ring-transparent focus-within:ring-accent'}"
  >
    {#if singleLine}
      {#key masked}
        <input
          bind:this={field}
          type={masked ? "password" : "text"}
          inputmode={numeric ? "decimal" : url ? "url" : undefined}
          autocapitalize={url ? "off" : undefined}
          autocorrect={url ? "off" : undefined}
          spellcheck={url ? false : undefined}
          enterkeyhint={enterKeyHint}
          disabled={!enabled}
          {readonly}
          {value}
          {placeholder}
          {onkeydown}
          oninput={handle}
          style={actionsReserve}
          class={FIELD_INPUT_CLASS}
        />
      {/key}
    {:else}
      <div style={actionsReserve} class="relative flex min-w-0 flex-1">
        {#if placeholder && !value}
          <span
            style="line-height: {LINE_HEIGHT}px"
            class="pointer-events-none absolute inset-x-0 top-0 truncate text-body-md text-faint"
          >
            {placeholder}
          </span>
        {/if}
        <textarea
          bind:this={field}
          {readonly}
          {value}
          {onkeydown}
          rows={Math.max(1, Math.round(minLines))}
          oninput={handle}
          style="min-height: {minLines * LINE_HEIGHT}px{maxLines
            ? `; max-height: ${maxLines * LINE_HEIGHT}px`
            : ''}"
          class="{FIELD_INPUT_CLASS} field-auto no-scrollbar resize-none {maxLines ? '' : 'max-h-80'}"
        ></textarea>
      </div>
    {/if}
    {#if onClear || secret || trailing}
      <span
        bind:clientWidth={actionsWidth}
        class={FIELD_ACTIONS_CLASS}
      >
        {#if onClear}
          <span class="flex" class:invisible={!showClear}>
            <TooltipIconButton
              label={t("CANCEL")}
              tooltip={false}
              enabled={showClear}
              onclick={() => onClear?.()}
            >
              <X />
            </TooltipIconButton>
          </span>
        {/if}
        {#if secret}
          <TooltipIconButton
            label={t(revealed ? "HIDE" : "SHOW")}
            tooltip={false}
            onclick={() => (revealed = !revealed)}
          >
            {#if revealed}
              <EyeOff />
            {:else}
              <Eye />
            {/if}
          </TooltipIconButton>
        {/if}
        {@render trailing?.()}
      </span>
    {/if}
  </div>
  {#if error}
    <ErrorText text={error} class="mt-1" />
  {/if}
</div>
