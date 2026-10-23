<script lang="ts">
  import Button from "./Button.svelte";
  import type { IconSource } from "./icons";

  interface Props {
    text: string;
    onclick: () => void;
    icon?: IconSource;
    enabled?: boolean;
    danger?: boolean;
    class?: string;
  }

  const { text, onclick, icon: IconComponent, enabled = true, danger = false, class: className = "" }: Props = $props();
</script>

<Button {onclick} {enabled} variant={danger ? "danger" : "outlined"} class={className}>
  {#if IconComponent}
    <IconComponent size={16} class="shrink-0" />
  {/if}
  <span class="truncate">{text}</span>
</Button>
