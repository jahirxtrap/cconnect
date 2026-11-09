<script lang="ts">
  import Maximize2 from "@lucide/svelte/icons/maximize-2";
  import { ROUND_ARROW_CLASS, ROUND_ICON_SIZE } from "./roundButton";

  interface Props {
    label: string;
    onclick: () => void;
  }

  const { label, onclick }: Props = $props();
</script>

<button type="button" {onclick} aria-label={label} class="{ROUND_ARROW_CLASS} absolute top-2 right-2 z-10">
  <Maximize2 size={ROUND_ICON_SIZE} />
</button>
