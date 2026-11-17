<script lang="ts">
  interface Props {
    tint: string | null;
    opacity: number;
    column?: boolean;
  }

  const { tint, opacity, column = false }: Props = $props();

  let band = $state<HTMLDivElement | null>(null);
  let gutters = $state(false);

  $effect(() => {
    const element = band;
    const frame = element?.parentElement?.parentElement;
    if (!element || !frame) return;
    const measure = () => {
      gutters = element.getBoundingClientRect().width < frame.getBoundingClientRect().width - 1;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(frame);
    return () => observer.disconnect();
  });
</script>

<div class="absolute inset-y-0 right-0 left-0 {column ? 'veil-column mx-auto w-full' : ''}">
  <div
    bind:this={band}
    class="absolute inset-0 {column && gutters ? 'veil-fade' : ''}"
    style="background-color: {tint ?? 'var(--c-card-bg)'}; opacity: {opacity}"
  ></div>
</div>
