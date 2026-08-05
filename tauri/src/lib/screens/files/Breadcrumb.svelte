<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import House from "@lucide/svelte/icons/house";

  interface Props {
    path: string;
    onNavigate: (target: string) => void;
  }

  const { path, onNavigate }: Props = $props();

  let scroller = $state<HTMLDivElement | null>(null);

  const segments = $derived(path.split("/").filter(Boolean));

  const targetAt = (index: number) => segments.slice(0, index + 1).join("/");

  $effect(() => {
    void path;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  });
</script>

<div class="px-3 py-2">
  <div class="flex h-11 items-center rounded-full bg-surface-variant pr-3 pl-2">
    <button
      type="button"
      onclick={() => onNavigate("")}
      aria-label="/"
      class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full {segments.length
        ? 'text-on-surface-variant'
        : 'text-accent'}"
    >
      <House size={20} />
    </button>
    <div bind:this={scroller} class="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto">
      {#each segments as segment, index (targetAt(index))}
        <ChevronRight size={16} class="mx-0.5 shrink-0 text-on-surface-variant" />
        <button
          type="button"
          onclick={() => onNavigate(targetAt(index))}
          class="shrink-0 cursor-pointer rounded-panel px-1 py-1 text-body-md whitespace-nowrap {index ===
          segments.length - 1
            ? 'font-semibold text-accent'
            : 'text-on-surface-variant'}"
        >
          {segment}
        </button>
      {/each}
    </div>
  </div>
</div>
