<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import House from "@lucide/svelte/icons/house";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import { t } from "$lib/i18n/index.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";

  interface Props {
    path: string;
    searching: boolean;
    query: string;
    searchable: boolean;
    onQueryChange: (value: string) => void;
    onToggleSearch: () => void;
    onNavigate: (target: string) => void;
  }

  const {
    path,
    searching,
    query,
    searchable,
    onQueryChange,
    onToggleSearch,
    onNavigate,
  }: Props = $props();

  const BUTTON_CLASS =
    "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8";

  let scroller = $state<HTMLDivElement | null>(null);
  let field = $state<HTMLInputElement | null>(null);

  const segments = $derived(path.split("/").filter(Boolean));

  const targetAt = (index: number) => segments.slice(0, index + 1).join("/");

  $effect(() => {
    void path;
    if (!searching && scroller) scroller.scrollLeft = scroller.scrollWidth;
  });

  $effect(() => {
    if (searching) field?.focus();
  });
</script>

<div class="px-4 py-2">
  <div class="flex h-10 items-center rounded-md bg-surface-variant/60 px-1">
    {#if searching}
      <span class="inline-flex size-8 shrink-0 items-center justify-center text-on-surface-variant">
        <Search size={18} />
      </span>
      <input
        bind:this={field}
        value={query}
        oninput={(event) => onQueryChange((event.currentTarget as HTMLInputElement).value)}
        placeholder={t("SEARCH")}
        class="min-w-0 flex-1 bg-transparent px-1 text-body-md caret-accent outline-none placeholder:text-on-surface-variant"
      />
      <button
        type="button"
        onclick={() => (query ? onQueryChange("") : onToggleSearch())}
        aria-label={t("CLOSE")}
        class="{BUTTON_CLASS} text-on-surface-variant"
      >
        <X size={18} />
      </button>
    {:else}
      <button
        type="button"
        onclick={() => onNavigate("")}
        aria-label="/"
        class="{BUTTON_CLASS} {segments.length ? 'text-on-surface-variant' : 'text-on-surface'}"
      >
        <House size={18} />
      </button>
      <div
        bind:this={scroller}
        use:hscrollbar={{ wheel: true }}
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
      {#if searchable}
        <button
          type="button"
          onclick={onToggleSearch}
          aria-label={t("SEARCH")}
          class="{BUTTON_CLASS} text-on-surface-variant"
        >
          <Search size={18} />
        </button>
      {/if}
    {/if}
  </div>
</div>
