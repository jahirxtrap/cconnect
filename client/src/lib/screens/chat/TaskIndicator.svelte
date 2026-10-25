<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Square from "@lucide/svelte/icons/square";
  import SquareCheckBig from "@lucide/svelte/icons/square-check-big";
  import type { TodoItem } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import HeaderListMenu from "./HeaderListMenu.svelte";

  interface Props {
    todos: TodoItem[];
  }

  const { todos }: Props = $props();

  const PIE = 18;
  const MARK = 20;
  const FULL_TURN = 360;
  const HALF_TURN = 180;
  const QUARTER_TURN = 90;
  const CENTER = PIE / 2;
  const RADIUS = PIE / 2;

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
  <HeaderListMenu label={t("TASKS")} count="{done}/{todos.length}">
    {#snippet trigger()}
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
          <Check size={12} class="absolute text-on-accent [stroke-width:2.6]" />
        {/if}
      </span>
    {/snippet}
    {#each todos as todo, index (index)}
      {@const finished = todo.status === "completed"}
      {@const active = todo.status === "in_progress"}
      <div class="flex items-start gap-2.5 px-2.5 py-1.5">
        <span class="flex h-5 shrink-0 items-center">
          {#if finished}
            <SquareCheckBig size={MARK} class="text-accent" />
          {:else if active}
            <CircleDot size={MARK} class="text-accent" />
          {:else}
            <Square size={MARK} class="text-on-surface-variant" />
          {/if}
        </span>
        <span
          class="min-w-0 flex-1 text-body-md {finished ? 'text-faint line-through' : ''} {active
            ? 'text-on-surface'
            : ''}"
        >
          {active && todo.activeForm ? todo.activeForm : todo.content}
        </span>
      </div>
    {/each}
  </HeaderListMenu>
{/if}
