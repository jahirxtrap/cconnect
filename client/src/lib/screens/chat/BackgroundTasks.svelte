<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import type { BackgroundTask } from "$lib/data/chatModels";
  import { formatDuration, formatTokens, joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import StopButton from "$lib/ui/StopButton.svelte";
  import { MENU_ICON_SIZE } from "$lib/ui/menuSurface";
  import HeaderListMenu from "./HeaderListMenu.svelte";

  interface Props {
    tasks: BackgroundTask[];
    onStop: (id: string) => void;
  }

  const { tasks, onStop }: Props = $props();

  const statOf = (task: BackgroundTask): string | null =>
    joined(task.durationMs !== null && formatDuration(task.durationMs), task.tokens !== null && formatTokens(task.tokens)) || null;
</script>

{#if tasks.length}
  <HeaderListMenu label={t("RUNNING_TASKS")} count={String(tasks.length)}>
    {#snippet trigger()}
      <Bot size={18} class="text-accent" />
    {/snippet}
    {#each tasks as task (task.id)}
      <div class="flex min-h-8 items-center gap-2 py-0.5 pr-0.5 pl-2.5">
        <StatusDot box={MENU_ICON_SIZE} loading />
        <div class="min-w-0 flex-1">
          <p class="truncate text-body-md">{task.description || t("AGENT")}</p>
          {#if statOf(task)}
            <p class="truncate text-body-sm text-on-surface-variant">{statOf(task)}</p>
          {/if}
        </div>
        <StopButton onclick={() => onStop(task.id)} />
      </div>
    {/each}
  </HeaderListMenu>
{/if}
