<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronsLeft from "@lucide/svelte/icons/chevrons-left";
  import ChevronsRight from "@lucide/svelte/icons/chevrons-right";
  import { formatDecimal } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { BAR_ACTION_CLASS } from "$lib/ui/actionBar";
  import GridBar from "./GridBar.svelte";

  interface Props {
    page: number;
    size: number;
    total: number;
    shown: number;
    sizes: number[];
    onPage: (page: number) => void;
    onSize: (size: number) => void;
  }

  const { page, size, total, shown, sizes, onPage, onSize }: Props = $props();

  let open = $state(false);

  const pages = $derived(Math.max(1, Math.ceil(total / Math.max(size, 1))));
  const first = $derived(shown ? (page - 1) * size + 1 : 0);
  const last = $derived((page - 1) * size + shown);
  const count = (value: number) => formatDecimal(value, 0);
</script>

<GridBar label={t("DATABASE_ROWS_RANGE", count(first), count(last), count(total))}>
  <PopupMenu
    {open}
    onOpenChange={(value) => (open = value)}
    label={t("DATABASE_PAGE_SIZE")}
    side="top"
    align="end"
    triggerClass="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 text-label-md text-on-surface-variant transition-colors hover:bg-hover"
  >
    {#snippet trigger()}
      <span>{t("DATABASE_PER_PAGE", count(size))}</span>
      <ChevronDown size={14} />
    {/snippet}
    {#each sizes as option (option)}
      <MenuItem
        text={count(option)}
        selected={option === size}
        onclick={() => {
          open = false;
          onSize(option);
        }}
      />
    {/each}
  </PopupMenu>
  <TooltipIconButton label={t("DATABASE_FIRST_PAGE")} class={BAR_ACTION_CLASS} enabled={page > 1} onclick={() => onPage(1)}>
    <ChevronsLeft />
  </TooltipIconButton>
  <TooltipIconButton label={t("DATABASE_PREVIOUS_PAGE")} class={BAR_ACTION_CLASS} enabled={page > 1} onclick={() => onPage(page - 1)}>
    <ChevronLeft />
  </TooltipIconButton>
  <span class="shrink-0 px-1 text-label-md text-on-surface-variant tabular-nums">{count(page)} / {count(pages)}</span>
  <TooltipIconButton label={t("DATABASE_NEXT_PAGE")} class={BAR_ACTION_CLASS} enabled={page < pages} onclick={() => onPage(page + 1)}>
    <ChevronRight />
  </TooltipIconButton>
  <TooltipIconButton label={t("DATABASE_LAST_PAGE")} class={BAR_ACTION_CLASS} enabled={page < pages} onclick={() => onPage(pages)}>
    <ChevronsRight />
  </TooltipIconButton>
</GridBar>
