<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import House from "@lucide/svelte/icons/house";
  import { hscrollbar } from "$lib/ui/scrollbar";

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

<div class="px-4 py-2">
  <div class="flex h-9 items-center rounded-md bg-surface-variant/60 pr-2 pl-1">
    <button
      type="button"
      onclick={() => onNavigate("")}
      aria-label="/"
      class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-on-surface/8 {segments.length
        ? 'text-on-surface-variant'
        : 'text-on-surface'}"
    >
      <House size={16} />
    </button>
    <div
      bind:this={scroller}
      use:hscrollbar={{ touchIndicator: false, wheel: true, gutter: false }}
      class="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto"
    >
      {#each segments as segment, index (targetAt(index))}
        <ChevronRight size={14} class="mx-0.5 shrink-0 text-on-surface-variant/60" />
        <button
          type="button"
          onclick={() => onNavigate(targetAt(index))}
          class="shrink-0 cursor-pointer rounded-sm px-1.5 py-0.5 text-body-md whitespace-nowrap transition-colors hover:bg-on-surface/8 {index ===
          segments.length - 1
            ? 'font-medium text-on-surface'
            : 'text-on-surface-variant'}"
        >
          {segment}
        </button>
      {/each}
    </div>
  </div>
</div>
