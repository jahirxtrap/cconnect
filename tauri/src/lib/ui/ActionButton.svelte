<script lang="ts">
  import Button from "./Button.svelte";
  import type { IconSource } from "./icons";

  interface Props {
    text: string;
    onclick: () => void;
    icon?: IconSource;
    enabled?: boolean;
    class?: string;
  }

  const { text, onclick, icon: IconComponent, enabled = true, class: className = "" }: Props = $props();
</script>

<Button {onclick} {enabled} variant="outlined" class={className}>
  {#if IconComponent}
    <IconComponent size={18} class="shrink-0" />
  {/if}
  <span class="truncate">{text}</span>
</Button>
