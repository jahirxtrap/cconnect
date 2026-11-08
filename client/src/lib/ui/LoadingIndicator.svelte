<script lang="ts">
  import { currentPath, FILL_BOX, INSET_BOX, onFrame } from "./loadingShapes";

  interface Props {
    size?: number;
    fill?: boolean;
    class?: string;
  }

  const { size = 16, fill = false, class: className = "text-accent" }: Props = $props();

  let shape = $state(currentPath());

  const box = $derived(fill ? FILL_BOX : INSET_BOX);

  $effect(() => onFrame((path) => (shape = path)));
</script>

<svg
  width={size}
  height={size}
  viewBox="{-box / 2} {-box / 2} {box} {box}"
  class="shrink-0 {className}"
  aria-hidden="true"
>
  <path d={shape} fill="currentColor" />
</svg>
