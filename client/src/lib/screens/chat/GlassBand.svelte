<script lang="ts">
  interface Props {
    blur: number | null;
    tint: string | null;
    opacity: number;
    screen?: boolean;
    column?: boolean;
  }

  const { blur, tint, opacity, screen = false, column = false }: Props = $props();

  const STD_PER_PX = 0.5;

  const id = $props.id();
  const fade = $derived(column ? "glass-fade" : "");
  const radius = $derived(blur === null ? "var(--glass-blur)" : `${blur}px`);
  const frost = $derived(screen && tint !== null && blur !== null);
</script>

<div class="absolute inset-y-0 right-0 left-0 {column ? 'glass-column mx-auto w-full' : ''}">
  {#if frost}
    <svg aria-hidden="true" width="0" height="0" class="absolute">
      <filter id="frost-{id}" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation={(blur ?? 0) * STD_PER_PX} result="blurred" />
        <feFlood flood-color={tint} flood-opacity={opacity} result="tint" />
        <feBlend in="tint" in2="blurred" mode="screen" />
      </filter>
    </svg>
    <div class="absolute inset-0 {fade}" style="backdrop-filter: url(#frost-{id}); -webkit-backdrop-filter: url(#frost-{id})"></div>
  {:else}
    {#if blur !== 0}
      <div class="absolute inset-0 {fade}" style="backdrop-filter: blur({radius}); -webkit-backdrop-filter: blur({radius})"></div>
    {/if}
    <div class="absolute inset-0 {fade}" style="background-color: {tint ?? 'var(--c-card-bg)'}; opacity: {opacity}"></div>
  {/if}
</div>
