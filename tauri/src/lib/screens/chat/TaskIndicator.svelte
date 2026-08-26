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

  const PIE = 24;
  const FULL_TURN = 360;
  const HALF_TURN = 180;
  const QUARTER_TURN = 90;
  const CENTER = PIE / 2;
  const RADIUS = PIE / 2;

  let open = $state(false);

  const done = $derived(todos.filter((todo) => todo.status === "completed").length);
  const running = $derived(todos.filter((todo) => todo.status === "in_progress").length);
  const doneSweep = $derived(todos.length ? (FULL_TURN * done) / todos.length : 0);
  const runningSweep = $derived(todos.length ? (FULL_TURN * running) / todos.length : 0);
  const complete = $derived(todos.length > 0 && done === todos.length);

  const edge = (angle: number) => {
    const radians = ((angle - QUARTER_TURN) * Math.PI) / HALF_TURN;
    return `${CENTER + RADIUS * Math.cos(radians)} ${CENTER + RADIUS * Math.sin(radians)}`;
  };

  const sector = (start: number, sweep: number) =>
    `M ${CENTER} ${CENTER} L ${edge(start)} A ${RADIUS} ${RADIUS} 0 ${sweep > HALF_TURN ? 1 : 0} 1 ${edge(start + sweep)} Z`;
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
          <circle cx={CENTER} cy={CENTER} r={RADIUS} class="fill-on-surface/15" />
          {#if doneSweep >= FULL_TURN}
            <circle cx={CENTER} cy={CENTER} r={RADIUS} class="fill-accent" />
          {:else if doneSweep > 0}
            <path d={sector(0, doneSweep)} class="fill-accent" />
          {/if}
          {#if runningSweep > 0 && doneSweep < FULL_TURN}
            <path d={sector(doneSweep, runningSweep)} class="fill-on-surface-variant" />
          {/if}
        </svg>
        {#if complete}
          <Check size={16} class="absolute text-on-accent" />
        {/if}
      </span>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        sideOffset={6}
        class="menu-surface scrollbar-thin z-70 max-h-96 w-80 overflow-y-auto rounded-md border-2 border-outline-variant bg-surface-variant p-1 shadow-lg"
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
