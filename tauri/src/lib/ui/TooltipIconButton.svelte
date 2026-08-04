<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";

  interface Props {
    label: string;
    onclick: () => void;
    enabled?: boolean;
    class?: string;
    children: Snippet;
  }

  const { label, onclick, enabled = true, class: className = "", children }: Props = $props();

  const TRIGGER_CLASS =
    "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors enabled:hover:bg-on-surface/8 disabled:cursor-default disabled:opacity-40";
</script>

{#if isTouch}
  <button type="button" disabled={!enabled} aria-label={label} {onclick} class="{TRIGGER_CLASS} {className}">
    {@render children()}
  </button>
{:else}
  <Tooltip.Provider>
    <Tooltip.Root delayDuration={400}>
      <Tooltip.Trigger
        disabled={!enabled}
        aria-label={label}
        {onclick}
        class="{TRIGGER_CLASS} {className}"
      >
        {@render children()}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          class="z-50 rounded-panel bg-surface-variant px-2 py-1 text-body-sm shadow-lg"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
