<script lang="ts">
  import type { Snippet } from "svelte";
  import CompactSwitch from "./CompactSwitch.svelte";

  interface Props {
    title: string;
    required?: boolean;
    checked: boolean;
    onChange: (checked: boolean) => void;
    summary?: string | null;
    enabled?: boolean;
    class?: string;
    leading?: Snippet;
  }

  const {
    title,
    required = false,
    checked,
    onChange,
    summary = null,
    enabled = true,
    class: className = "",
    leading,
  }: Props = $props();
</script>

<button
  type="button"
  disabled={!enabled}
  onclick={() => onChange(!checked)}
  class="flex w-full items-center rounded-lg px-3 py-2.5 text-left transition-colors enabled:cursor-pointer enabled:hover:bg-on-surface/8 disabled:opacity-40 {className}"
>
  {#if leading}
    <span class="mr-3 flex shrink-0 items-center">{@render leading()}</span>
  {/if}
  <span class="min-w-0 flex-1">
    <span class="block truncate text-body-md"
      >{title}{#if required}<span class="text-error"> *</span>{/if}</span
    >
    {#if summary}
      <span class="block text-body-sm text-on-surface-variant">{summary}</span>
    {/if}
  </span>
  <span class="ml-3 shrink-0">
    <CompactSwitch {checked} {enabled} onCheckedChange={onChange} />
  </span>
</button>
