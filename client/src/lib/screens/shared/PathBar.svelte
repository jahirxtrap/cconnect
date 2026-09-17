<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import House from "@lucide/svelte/icons/house";
  import Search from "@lucide/svelte/icons/search";
  import { t } from "$lib/i18n/index.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";

  interface Props {
    path: string;
    root?: string;
    label?: string | null;
    nameOf?: (target: string, segment: string) => string;
    searching: boolean;
    query: string;
    searchable: boolean;
    narrow?: boolean;
    count?: string;
    onQueryChange: (value: string) => void;
    onToggleSearch: () => void;
    onNavigate: (target: string) => void;
  }

  const {
    path,
    root = "",
    label = null,
    nameOf = (_target, segment) => segment,
    searching,
    query,
    searchable,
    narrow = false,
    count = "",
    onQueryChange,
    onToggleSearch,
    onNavigate,
  }: Props = $props();

  const buttonClass = $derived(
    `inline-flex ${narrow ? "size-7" : "size-8"} shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8`,
  );

  const homeClass = $derived(
    label
      ? `inline-flex ${narrow ? "h-7 gap-2 pr-2.5 pl-2" : "h-8 gap-1.5 pr-3 pl-2.5"} shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8`
      : buttonClass,
  );

  let scroller = $state<HTMLDivElement | null>(null);

  const base = $derived(root ? root.split("/").filter(Boolean) : []);
  const segments = $derived(path.split("/").filter(Boolean).slice(base.length));

  const targetAt = (index: number) => [...base, ...segments.slice(0, index + 1)].join("/");

  $effect(() => {
    void path;
    if (!searching && scroller) scroller.scrollLeft = scroller.scrollWidth;
  });
</script>

<div class="px-4 py-2">
  {#if searching}
    <SearchBar
      value={query}
      oninput={onQueryChange}
      placeholder={t("SEARCH")}
      autofocus
      large={!narrow}
      onClose={onToggleSearch}
    />
  {:else}
    <div class="flex {narrow ? 'h-9' : 'h-10'} items-center rounded-md bg-surface-variant/60 px-1">
      <button
        type="button"
        onclick={() => onNavigate(root)}
        aria-label={label ?? "/"}
        class="{homeClass} {segments.length ? 'text-on-surface-variant' : 'text-on-surface'}"
      >
        <House size={18} />
        {#if label}
          <span class="max-w-32 truncate text-body-md font-medium">{label}</span>
        {/if}
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
            {nameOf(targetAt(index), segment)}
          </button>
        {/each}
      </div>
      {#if count}
        <span class="shrink-0 px-2 text-label-md text-on-surface-variant">{count}</span>
      {/if}
      {#if searchable}
        <button
          type="button"
          onclick={onToggleSearch}
          aria-label={t("SEARCH")}
          class="{buttonClass} text-on-surface-variant"
        >
          <Search size={18} />
        </button>
      {/if}
    </div>
  {/if}
</div>
