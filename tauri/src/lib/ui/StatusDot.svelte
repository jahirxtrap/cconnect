<script lang="ts">
  interface Props {
    class?: string;
    box?: number;
    dot?: number;
    color?: string | null;
  }

  const { class: className = "bg-gray", box = 14, dot = 8, color = null }: Props = $props();
</script>

<span
  class="inline-flex shrink-0 items-center justify-center"
  style="width: {box}px; height: {box}px"
>
  <span
    class="rounded-full {color ? '' : className}"
    style="width: {dot}px; height: {dot}px{color ? `; background: ${color}` : ''}"
  ></span>
</span>
