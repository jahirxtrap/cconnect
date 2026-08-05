<script lang="ts">
  import { onFrame, pathOf, SHAPE_COUNT, VIEW_BOX } from "./loadingShapes";

  interface Props {
    size?: number;
    class?: string;
  }

  const { size = 16, class: className = "text-accent" }: Props = $props();

  const MORPH_MS = 650;
  const ROTATION_MS = 4666;
  const QUARTER = 90;
  const DAMPING = 0.6;
  const STIFFNESS = 200;

  const natural = Math.sqrt(STIFFNESS);
  const damped = natural * Math.sqrt(1 - DAMPING * DAMPING);
  const decay = DAMPING * natural;

  const spring = (ms: number) => {
    const time = ms / 1000;
    const envelope = Math.exp(-decay * time);
    return 1 - envelope * (Math.cos(damped * time) + (decay / damped) * Math.sin(damped * time));
  };

  let path = $state(pathOf(0, 0));
  let angle = $state(0);

  $effect(() =>
    onFrame((elapsed) => {
      const step = Math.floor(elapsed / MORPH_MS);
      const progress = spring(elapsed % MORPH_MS);
      path = pathOf(step % SHAPE_COUNT, progress);
      angle = (elapsed / ROTATION_MS) * 360 + (step + progress) * QUARTER;
    }),
  );
</script>

<svg
  width={size}
  height={size}
  viewBox="{-VIEW_BOX / 2} {-VIEW_BOX / 2} {VIEW_BOX} {VIEW_BOX}"
  class="shrink-0 {className}"
  aria-hidden="true"
>
  <path d={path} fill="currentColor" transform="rotate({angle})" />
</svg>
