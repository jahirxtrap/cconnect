<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import type { BackgroundTask } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import StopButton from "$lib/ui/StopButton.svelte";
  import HeaderListMenu from "./HeaderListMenu.svelte";

  interface Props {
    tasks: BackgroundTask[];
    onStop: (id: string) => void;
  }

  const { tasks, onStop }: Props = $props();
</script>

{#if tasks.length}
  <HeaderListMenu label={t("RUNNING_TASKS")} count={String(tasks.length)}>
    {#snippet trigger()}
      <Bot size={18} class="text-accent" />
    {/snippet}
    {#each tasks as task (task.id)}
      <div class="flex items-center gap-2.5 py-0.5 pr-0.5 pl-2.5">
        <StatusDot loading />
        <span class="min-w-0 flex-1 truncate text-body-md">{task.description || t("AGENT")}</span>
        <StopButton onclick={() => onStop(task.id)} />
      </div>
    {/each}
  </HeaderListMenu>
{/if}
