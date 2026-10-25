<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import House from "@lucide/svelte/icons/house";
  import Search from "@lucide/svelte/icons/search";
  import { t } from "$lib/i18n/index.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { HSCROLL_CLASS, hscrollbar } from "$lib/ui/scrollbar";

  interface Props {
    path: string;
    root?: string;
    label?: string | null;
    nameOf?: (target: string, segment: string) => string;
    searching?: boolean;
    query?: string;
    searchable?: boolean;
    narrow?: boolean;
    count?: string;
    onQueryChange?: (value: string) => void;
    onToggleSearch?: () => void;
    onNavigate: (target: string) => void;
  }

  const {
    path,
    root = "",
    label = null,
    nameOf = (_target, segment) => segment,
    searching = false,
    query = "",
    searchable = false,
    narrow = false,
    count = "",
    onQueryChange,
    onToggleSearch,
    onNavigate,
  }: Props = $props();

  let scroller = $state<HTMLDivElement | null>(null);

  const crumbHeight = $derived(narrow ? "h-6" : "h-7");

  const base = $derived(root ? root.split("/").filter(Boolean) : []);
  const segments = $derived(path.split("/").filter(Boolean).slice(base.length));

  const targetAt = (index: number) => [...base, ...segments.slice(0, index + 1)].join("/");

  $effect(() => {
    void path;
    if (!searching && scroller) scroller.scrollLeft = scroller.scrollWidth;
  });
</script>

{#snippet crumbs()}
  <button
    type="button"
    onclick={() => onNavigate(root)}
    aria-label={label ?? "/"}
    class="inline-flex {crumbHeight} shrink-0 cursor-pointer items-center gap-1.5 rounded-sm transition-colors hover:bg-hover {label
      ? 'px-1.5'
      : `${narrow ? 'w-6' : 'w-7'} justify-center`} {segments.length
      ? 'text-on-surface-variant hover:text-on-surface'
      : 'text-on-surface'}"
  >
    <House size={14} class="shrink-0" />
    {#if label}
      <span class="max-w-32 truncate">{label}</span>
    {/if}
  </button>
  <div
    bind:this={scroller}
    use:hscrollbar={{ wheel: true }}
    class="{HSCROLL_CLASS} flex min-w-0 flex-1 items-center rounded-sm"
  >
    {#each segments as segment, index (targetAt(index))}
      <ChevronRight size={12} class="mx-0.5 shrink-0 text-faint" />
      <button
        type="button"
        onclick={() => onNavigate(targetAt(index))}
        class="inline-flex {crumbHeight} shrink-0 cursor-pointer items-center rounded-sm px-1.5 whitespace-nowrap transition-colors hover:bg-hover {index ===
        segments.length - 1
          ? 'text-on-surface'
          : 'text-on-surface-variant hover:text-on-surface'}"
      >
        {nameOf(targetAt(index), segment)}
      </button>
    {/each}
  </div>
  {#if count}
    <span class="shrink-0 px-1.5 text-caption text-faint">{count}</span>
  {/if}
{/snippet}

<div class="px-(--page-inset) pb-2">
  {#if searching}
    <SearchBar
      value={query}
      oninput={(value) => onQueryChange?.(value)}
      placeholder={t("SEARCH")}
      autofocus
      large={!narrow}
      onClose={onToggleSearch}
    />
  {:else}
    <div
      class="flex {narrow ? 'h-8' : 'h-9'} items-center gap-0.5 rounded-md bg-surface-variant px-1 text-body-sm"
    >
      {@render crumbs()}
      {#if searchable}
        <TooltipIconButton label={t("SEARCH")} class={narrow ? "size-6" : "size-7"} onclick={() => onToggleSearch?.()}>
          <Search />
        </TooltipIconButton>
      {/if}
    </div>
  {/if}
</div>
