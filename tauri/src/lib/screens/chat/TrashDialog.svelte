<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Trash from "@lucide/svelte/icons/trash";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { TrashedSession } from "$lib/services/sessionsApi";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState;
    onView: (item: TrashedSession) => void;
    onDismiss: () => void;
  }

  const { chat, onView, onDismiss }: Props = $props();

  const ID_PREVIEW = 8;

  let items = $state<TrashedSession[]>([]);
  let emptying = $state(false);
  let purging = $state<TrashedSession | null>(null);

  const load = async () => (items = (await chat.trash()).items);
  const labelOf = (item: TrashedSession) => item.title ?? item.sessionId.slice(0, ID_PREVIEW);

  void load();
</script>

<CompactDialog title={t("TRASH")} {onDismiss}>
  {#snippet titleTrailing()}
    <TooltipIconButton
      label={t("EMPTY_TRASH")}
      enabled={items.length > 0}
      class="size-8 [&_svg]:size-[18px]"
      onclick={() => (emptying = true)}
    >
      <Trash />
    </TooltipIconButton>
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  <div class="scrollbar-thin flex max-h-[420px] flex-col gap-1 overflow-y-auto">
    {#if items.length === 0}
      <p class="px-3 py-2.5 text-body-md text-on-surface-variant">{t("TRASH_EMPTY")}</p>
    {/if}
    {#each items as item (item.sessionId)}
      <div class="flex items-center rounded-item pr-1 transition-colors hover:bg-on-surface/8">
        <!-- Opens it read-only: deciding between restore and delete is easier having seen it. -->
        <button
          type="button"
          class="min-w-0 flex-1 cursor-pointer truncate px-3 py-2.5 text-left text-body-md"
          onclick={() => onView(item)}
        >
          {labelOf(item)}
        </button>
        <TooltipIconButton
          label={t("RESTORE")}
          class="size-8 [&_svg]:size-4"
          onclick={() => void chat.restoreTrashed(item.sessionId).then(load)}
        >
          <RotateCcw />
        </TooltipIconButton>
        <!-- Deleting here is the end of the line, so it asks like every other point of no return. -->
        <TooltipIconButton label={t("DELETE")} class="size-8 [&_svg]:size-4" onclick={() => (purging = item)}>
          <Trash />
        </TooltipIconButton>
      </div>
    {/each}
  </div>
</CompactDialog>

{#if purging}
  {@const target = purging}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_CONVERSATION_CONFIRM", labelOf(target))}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      void chat.purgeTrashed(target.sessionId).then(load);
      purging = null;
    }}
    onDismiss={() => (purging = null)}
  />
{/if}

{#if emptying}
  <ConfirmDialog
    title={t("EMPTY_TRASH")}
    text={t("EMPTY_TRASH_CONFIRM")}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      void chat.emptyTrash().then(load);
      emptying = false;
    }}
    onDismiss={() => (emptying = false)}
  />
{/if}
