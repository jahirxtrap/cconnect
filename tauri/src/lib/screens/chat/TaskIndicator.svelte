<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Square from "@lucide/svelte/icons/square";
  import SquareCheckBig from "@lucide/svelte/icons/square-check-big";
  import { DropdownMenu } from "bits-ui";
  import type { TodoItem } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";

  interface Props {
    todos: TodoItem[];
  }

  const { todos }: Props = $props();

  const FULL_TURN = 360;

  let open = $state(false);

  const done = $derived(todos.filter((todo) => todo.status === "completed").length);
  const running = $derived(todos.filter((todo) => todo.status === "in_progress").length);
  const doneAngle = $derived(todos.length ? (FULL_TURN * done) / todos.length : 0);
  const runningAngle = $derived(todos.length ? (FULL_TURN * running) / todos.length : 0);
  const complete = $derived(todos.length > 0 && done === todos.length);
</script>

{#if todos.length}
  <DropdownMenu.Root {open} onOpenChange={(value) => (open = value)}>
    <DropdownMenu.Trigger
      class="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8"
      aria-label={t("TASKS")}
    >
      <span
        class="flex size-6 items-center justify-center rounded-full"
        style="background: conic-gradient(var(--c-accent) 0deg {doneAngle}deg, var(--c-on-surface-variant) {doneAngle}deg {doneAngle +
          runningAngle}deg, color-mix(in srgb, var(--c-on-background) 15%, transparent) {doneAngle +
          runningAngle}deg 360deg)"
      >
        {#if complete}
          <Check size={12} class="text-on-accent" />
        {/if}
      </span>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={6}
        class="menu-surface scrollbar-thin z-50 max-h-96 w-80 overflow-y-auto rounded-md border border-outline-variant bg-surface-variant p-1 shadow-lg"
      >
        <p class="px-2 py-1.5 text-label-lg text-on-surface-variant">
          {t("TASKS")} ({done}/{todos.length})
        </p>
        {#each todos as todo, index (index)}
          {@const finished = todo.status === "completed"}
          {@const active = todo.status === "in_progress"}
          <div class="flex items-start gap-2 rounded-sm px-2 py-1.5">
            {#if finished}
              <SquareCheckBig size={16} class="mt-0.5 shrink-0 text-accent" />
            {:else if active}
              <CircleDot size={16} class="mt-0.5 shrink-0 text-accent" />
            {:else}
              <Square size={16} class="mt-0.5 shrink-0 text-on-surface-variant" />
            {/if}
            <span class="min-w-0 flex-1 text-body-md {finished ? 'text-on-surface-variant line-through' : ''}">
              {active && todo.activeForm ? todo.activeForm : todo.content}
            </span>
          </div>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
{/if}
