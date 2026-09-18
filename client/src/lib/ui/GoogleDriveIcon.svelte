<script lang="ts">
  import type { LucideProps } from "@lucide/svelte";

  const {
    size = 24,
    color = "currentColor",
    strokeWidth = 2,
    class: className = "",
  }: LucideProps = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class="shrink-0 {className}"
  aria-hidden="true"
>
  <path d="M12 9.25 5.4 20.25 2.1 14.75 8.7 3.75Z" />
  <path d="M8.7 14.75h13.2l-3.3 5.5H5.4" />
  <path d="M15.3 14.75 8.7 3.75h6.6l6.6 11Z" />
</svg>
