<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Square from "@lucide/svelte/icons/square";
  import SquareCheckBig from "@lucide/svelte/icons/square-check-big";
  import { DropdownMenu } from "bits-ui";
  import type { TodoItem } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import MenuScrim from "$lib/ui/MenuScrim.svelte";

  interface Props {
    todos: TodoItem[];
  }

  const { todos }: Props = $props();

  const PIE = 20;
  const QUARTER_TURN = -90;
  const FULL_TURN = 360;

  // A stroke as thick as the radius fills the disc, so dasharray sweeps whole slices.
  const RADIUS = PIE / 4;
  const SLICE = PIE / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  let open = $state(false);

  const done = $derived(todos.filter((todo) => todo.status === "completed").length);
  const running = $derived(todos.filter((todo) => todo.status === "in_progress").length);
  const doneRatio = $derived(todos.length ? done / todos.length : 0);
  const runningRatio = $derived(todos.length ? running / todos.length : 0);
  const complete = $derived(todos.length > 0 && done === todos.length);
</script>

{#if todos.length}
  <MenuScrim {open} onDismiss={() => (open = false)} />
  <DropdownMenu.Root {open} onOpenChange={(value) => (open = value)}>
    <DropdownMenu.Trigger
      class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8"
      aria-label={t("TASKS")}
    >
      <span class="relative inline-flex items-center justify-center">
        <svg width={PIE} height={PIE} viewBox="0 0 {PIE} {PIE}" class="shrink-0" aria-hidden="true">
          <circle cx={PIE / 2} cy={PIE / 2} r={PIE / 2} class="fill-on-surface/12" />
          {#if runningRatio > 0}
            <circle
              cx={PIE / 2}
              cy={PIE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              stroke-width={SLICE}
              stroke-dasharray={CIRCUMFERENCE}
              stroke-dashoffset={CIRCUMFERENCE * (1 - runningRatio)}
              transform="rotate({QUARTER_TURN + FULL_TURN * doneRatio} {PIE / 2} {PIE / 2})"
              class="text-on-surface-variant"
            />
          {/if}
          {#if doneRatio > 0}
            <circle
              cx={PIE / 2}
              cy={PIE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              stroke-width={SLICE}
              stroke-dasharray={CIRCUMFERENCE}
              stroke-dashoffset={CIRCUMFERENCE * (1 - doneRatio)}
              transform="rotate({QUARTER_TURN} {PIE / 2} {PIE / 2})"
              class="text-accent"
            />
          {/if}
          <circle
            cx={PIE / 2}
            cy={PIE / 2}
            r={(PIE - 1) / 2}
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            class="text-on-surface/20"
          />
        </svg>
        {#if complete}
          <Check size={12} class="absolute text-on-accent" />
        {/if}
      </span>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={6}
        class="menu-surface scrollbar-thin z-70 max-h-96 w-80 overflow-y-auto rounded-md border border-outline-variant bg-surface-variant p-1 shadow-lg"
      >
        <p class="px-3.5 pb-2 text-label-lg font-bold text-on-surface-variant">
          {t("TASKS")} ({done}/{todos.length})
        </p>
        <div class="mb-1 h-px bg-outline-variant"></div>
        {#each todos as todo, index (index)}
          {@const finished = todo.status === "completed"}
          {@const active = todo.status === "in_progress"}
          <div class="flex items-start gap-2 rounded-sm px-2 py-1.5">
            {#if finished}
              <SquareCheckBig size={20} class="mt-px shrink-0 text-accent" />
            {:else if active}
              <CircleDot size={20} class="mt-px shrink-0 text-accent" />
            {:else}
              <Square size={20} class="mt-px shrink-0 text-on-surface-variant" />
            {/if}
            <span
              class="min-w-0 flex-1 text-body-md {finished
                ? 'text-on-surface-variant line-through'
                : ''} {active ? 'font-semibold' : ''}"
            >
              {active && todo.activeForm ? todo.activeForm : todo.content}
            </span>
          </div>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
{/if}
