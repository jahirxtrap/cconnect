<script lang="ts">
  interface Props {
    size?: number;
  }

  const { size = 32 }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 108 108"
  class="shrink-0 rounded-xs"
  aria-hidden="true"
>
  <path
    d="M24,0 L84,0 A24,24 0 0 1 108,24 L108,84 A24,24 0 0 1 84,108 L24,108 A24,24 0 0 1 0,84 L0,24 A24,24 0 0 1 24,0 Z"
    fill="#171717"
  />
  <g transform="translate(54,54) scale(1.6) translate(-54,-54)">
    <g transform="translate(19.93,18.8) scale(0.55)">
      <path
        d="M21.94,64 a40,40 0 1,0 80,0 a40,40 0 1,0 -80,0"
        fill="none"
        stroke="#4D4D4D"
        stroke-width="12"
      />
      <path
        d="M87.7,33.4 A40,40 0 1 0 87.7,94.6"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="12"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M46,52 L58,64 L46,76"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M64,76 L80,76"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
  </g>
</svg>
