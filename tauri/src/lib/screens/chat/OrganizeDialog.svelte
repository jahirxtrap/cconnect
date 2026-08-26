<script lang="ts">
  import GripHorizontal from "@lucide/svelte/icons/grip-horizontal";
  import Trash from "@lucide/svelte/icons/trash";
  import type { ChatCategory, ProjectInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EditableText from "$lib/ui/EditableText.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState;
    onDismiss: () => void;
  }

  const { chat, onDismiss }: Props = $props();

  const LONG_PRESS_MS = 400;
  const SPACING = 4;

  let editing = $state<string | null>(null);
  let draft = $state("");
  let deletingCategory = $state<ChatCategory | null>(null);
  let deletingProject = $state<ProjectInfo | null>(null);
  let draggingId = $state<string | null>(null);
  let dragDy = $state(0);
  let step = $state(0);
  let settling = $state(false);

  let listElement = $state<HTMLDivElement | null>(null);

  const heightOf = (id: string) =>
    listElement?.querySelector<HTMLElement>(`[data-category="${id}"]`)?.offsetHeight ?? 0;

  const dragFrom = $derived(chat.categories.findIndex((item) => item.id === draggingId));
  // Where the dragged row would land; the rows in between open the gap for it.
  const dropIndex = $derived(
    draggingId === null || step <= 0
      ? -1
      : Math.max(0, Math.min(dragFrom + Math.round(dragDy / step), chat.categories.length - 1)),
  );

  const shiftOf = (index: number) => {
    if (dropIndex < 0 || index === dragFrom) return 0;
    if (dropIndex > dragFrom && index > dragFrom && index <= dropIndex) return -step;
    if (dropIndex < dragFrom && index < dragFrom && index >= dropIndex) return step;
    return 0;
  };

  const projectLabel = (project: ProjectInfo) => project.name ?? project.path ?? project.projectKey;

  const commit = (category: ChatCategory) => {
    if (draft.trim() && draft !== category.name) void chat.renameCategory(category, draft);
    editing = null;
  };

  const startDrag = (event: PointerEvent, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    let lastY = event.clientY;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const detach = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const begin = () => {
      step = heightOf(id) + SPACING;
      dragDy = 0;
      draggingId = id;
    };

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      if (draggingId !== id) {
        lastY = move.clientY;
        return;
      }
      dragDy += move.clientY - lastY;
      lastY = move.clientY;
    };

    const onUp = (up: Event) => {
      if (up instanceof PointerEvent && up.pointerId !== event.pointerId) return;
      detach();
      const target = draggingId === id && dropIndex >= 0 && dropIndex !== dragFrom ? dropIndex : -1;
      if (target >= 0) {
        // The rows land where the gap already showed them, so the reorder must not animate.
        settling = true;
        chat.reorderCategory(id, target);
        void chat.commitCategoryOrder(id);
        requestAnimationFrame(() => requestAnimationFrame(() => (settling = false)));
      }
      draggingId = null;
      dragDy = 0;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    if (isTouch) timer = setTimeout(begin, LONG_PRESS_MS);
    else begin();
  };
</script>

<CompactDialog title={t("ORGANIZE")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  <!-- A drag owns the pointer: nothing under it may claim the cursor or react to hover. -->
  <div
    bind:this={listElement}
    class="scrollbar-thin flex max-h-[420px] flex-col gap-1 overflow-y-auto {draggingId === null ? '' : 'cursor-pointer'}"
  >
    <SelectField
      label={t("CHAT_ORDER")}
      selected={chat.chatOrder}
      options={[
        { value: "auto", label: t("CHAT_ORDER_AUTO") },
        { value: "manual", label: t("CHAT_ORDER_MANUAL") },
      ]}
      onSelect={(value) => void chat.setChatOrder(value)}
    />

    <p class="mt-1 mb-1.5 text-label-lg">{t("CATEGORIES")}</p>
    {#each chat.categories as category, index (category.id)}
      {@const dragging = draggingId === category.id}
      <div
        data-category={category.id}
        class="flex items-center rounded-item pr-1 {dragging ? 'bg-on-surface/8' : ''} {draggingId === null
          ? ''
          : 'pointer-events-none'}"
        style="transform: translateY({dragging ? dragDy : shiftOf(index)}px); z-index: {dragging
          ? 1
          : 0}; transition: {dragging || settling ? 'none' : 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'}"
      >
        <span
          class="flex size-7 shrink-0 cursor-pointer touch-none items-center justify-center text-on-surface-variant"
          onpointerdown={(event) => startDrag(event, category.id)}
          role="presentation"
        >
          <GripHorizontal size={16} />
        </span>
        <div class="min-w-0 flex-1">
          <EditableText
            value={editing === category.id ? draft : category.name}
            editing={editing === category.id}
            onEdit={() => {
              editing = category.id;
              draft = category.name;
            }}
            oninput={(value) => (draft = value)}
            onCommit={() => commit(category)}
            onCancel={() => (editing = null)}
          />
        </div>
        <TooltipIconButton label={t("DELETE")} class="size-8 [&_svg]:size-4" onclick={() => (deletingCategory = category)}>
          <Trash />
        </TooltipIconButton>
      </div>
    {/each}
    <ActionButton
      class="w-full"
      text={t("ADD_CATEGORY")}
      onclick={() => void chat.createCategory(`${t("CATEGORY")} ${chat.categories.length + 1}`)}
    />

    <p class="mt-1 mb-1.5 text-label-lg">{t("PROJECTS")}</p>
    {#each chat.historyProjects as project (project.projectKey)}
      <div class="flex items-center pr-1">
        <span class="min-w-0 flex-1 truncate px-3 py-2.5 text-body-md">{projectLabel(project)}</span>
        <TooltipIconButton label={t("DELETE")} class="size-8 [&_svg]:size-4" onclick={() => (deletingProject = project)}>
          <Trash />
        </TooltipIconButton>
      </div>
    {/each}
  </div>
</CompactDialog>

{#if deletingCategory}
  {@const target = deletingCategory}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_CATEGORY_CONFIRM", target.name)}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      void chat.deleteCategory(target);
      deletingCategory = null;
    }}
    onDismiss={() => (deletingCategory = null)}
  />
{/if}

{#if deletingProject}
  {@const target = deletingProject}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_PROJECT_CONFIRM", projectLabel(target))}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      void chat.deleteProject(target.projectKey);
      deletingProject = null;
    }}
    onDismiss={() => (deletingProject = null)}
  />
{/if}
