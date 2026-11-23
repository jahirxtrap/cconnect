<script lang="ts">
  import { FILL_BOX, INSET_BOX, LOBE_FRAMES, LOBE_WINDOW, lobeCycle, lobeSprite } from "./loadingShapes";

  interface Props {
    size?: number;
    fill?: boolean;
    class?: string;
  }

  const { size = 16, fill = false, class: className = "text-accent" }: Props = $props();

  const sprite = $derived(lobeSprite(fill ? FILL_BOX : INSET_BOX));
</script>

<span
  class="lobes shrink-0 {className}"
  style="--lobes-size: {size}px; --lobes-window: {LOBE_WINDOW}; --lobes-frames: {LOBE_FRAMES}; --lobes-sprite: url({sprite})"
  aria-hidden="true"
>
  <span><span use:lobeCycle></span></span>
</span>
