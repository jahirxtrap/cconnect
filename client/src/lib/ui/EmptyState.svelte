<script lang="ts" module>
  import SearchX from "@lucide/svelte/icons/search-x";

  export const NO_RESULTS_ICON = SearchX;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import CenteredProgress from "./CenteredProgress.svelte";
  import IconTile from "./IconTile.svelte";
  import type { IconSource } from "./icons";

  interface Props {
    text: string;
    detail?: string | null;
    icon?: IconSource;
    loading?: boolean;
    class?: string;
    action?: Snippet;
  }

  const { text, detail = null, icon: IconComponent, loading = false, class: className = "", action }: Props = $props();

  const BLOCK_PADDING_CLASS = /(^|\s)py-\S+/;
</script>

{#if loading}
  <CenteredProgress class={className} />
{:else}
  <div
    class="flex flex-col items-center justify-center gap-3 px-6 {BLOCK_PADDING_CLASS.test(className)
      ? ''
      : 'py-4'} text-center {className}"
  >
    {#if IconComponent}
      <IconTile icon={IconComponent} />
    {/if}
    <div class="flex flex-col items-center gap-1">
      <p class={IconComponent ? "text-label-lg text-on-surface" : "text-body-md text-on-surface-variant"}>{text}</p>
      {#if detail}
        <p class="text-body-md text-on-surface-variant">{detail}</p>
      {/if}
    </div>
    {#if action}
      <div class="flex flex-wrap justify-center gap-2">{@render action()}</div>
    {/if}
  </div>
{/if}
