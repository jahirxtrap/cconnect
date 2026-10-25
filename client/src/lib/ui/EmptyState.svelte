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
</script>

{#if loading}
  <CenteredProgress class={className} />
{:else}
  <div class="flex flex-col items-center justify-center gap-2 px-6 py-4 text-center {className}">
    {#if IconComponent}
      <IconTile icon={IconComponent} class="mb-1" />
    {/if}
    <p class={IconComponent ? "text-label-lg text-on-surface" : "text-body-md text-on-surface-variant"}>{text}</p>
    {#if detail}
      <p class="text-body-md text-on-surface-variant">{detail}</p>
    {/if}
    {#if action}
      <div class="mt-2 flex flex-wrap justify-center gap-2">{@render action()}</div>
    {/if}
  </div>
{/if}
