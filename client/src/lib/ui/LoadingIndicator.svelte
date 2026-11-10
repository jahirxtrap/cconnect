<script lang="ts">
  import { FILL_BOX, INSET_BOX, LOBE_CYCLE_MS, LOBE_FRAMES, LOBE_WINDOW, lobePhase, lobeSprite } from "./loadingShapes";

  interface Props {
    size?: number;
    fill?: boolean;
    class?: string;
  }

  const { size = 16, fill = false, class: className = "text-accent" }: Props = $props();

  const phase = lobePhase();

  const sprite = $derived(lobeSprite(fill ? FILL_BOX : INSET_BOX));
</script>

<span
  class="lobes shrink-0 {className}"
  style="--lobes-size: {size}px; --lobes-window: {LOBE_WINDOW}; --lobes-frames: {LOBE_FRAMES}; --lobes-cycle: {LOBE_CYCLE_MS}ms; --lobes-phase: {phase}ms; --lobes-sprite: url({sprite})"
  aria-hidden="true"
>
  <span><span></span></span>
</span>
