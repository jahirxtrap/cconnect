<script lang="ts">
  import LogoGlyph from "./LogoGlyph.svelte";

  interface Props {
    size?: number;
  }

  const { size = 32 }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 108 108"
  class="shrink-0 rounded-md"
  aria-hidden="true"
>
  <path
    d="M24,0 L84,0 A24,24 0 0 1 108,24 L108,84 A24,24 0 0 1 84,108 L24,108 A24,24 0 0 1 0,84 L0,24 A24,24 0 0 1 24,0 Z"
    class="fill-logo"
  />
  <LogoGlyph ring="stroke-logo-ring" mark="stroke-logo-mark" />
</svg>
