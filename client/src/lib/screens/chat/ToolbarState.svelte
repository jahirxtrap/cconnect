<script lang="ts">
  import type { IconSource } from "$lib/ui/icons";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import { CHIP_ICON_SIZE, CHIP_STATE_CLASS } from "./toolbarChips";

  interface Props {
    text: string;
    loading?: boolean;
    dot?: string;
    icon?: IconSource;
  }

  const { text, loading = false, dot, icon: Icon }: Props = $props();
</script>

<span class={CHIP_STATE_CLASS}>
  {#if loading}
    <LoadingIndicator size={CHIP_ICON_SIZE} />
  {:else if dot}
    <StatusDot class={dot} box={CHIP_ICON_SIZE} />
  {:else if Icon}
    <Icon size={CHIP_ICON_SIZE} class="shrink-0 text-on-surface-variant" />
  {/if}
  <span class="whitespace-nowrap">{text}</span>
</span>
