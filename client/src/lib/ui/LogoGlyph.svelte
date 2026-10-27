<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    ring: string;
    mark: string;
  }

  const { ring, mark }: Props = $props();
</script>

<g transform="translate(54,54) scale(1.6) translate(-54,-54)">
  <g transform="translate(19.93,18.8) scale(0.55)">
    <path d="M21.94,64 a40,40 0 1,0 80,0 a40,40 0 1,0 -80,0" fill="none" class={ring} stroke-width="12" />
    <path
      d="M87.7,33.4 A40,40 0 1 0 87.7,94.6"
      fill="none"
      class={mark}
      stroke-width="12"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M46,52 L58,64 L46,76"
      fill="none"
      class={mark}
      stroke-width="10"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M64,76 L80,76"
      fill="none"
      class={mark}
      stroke-width="10"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
</g>
