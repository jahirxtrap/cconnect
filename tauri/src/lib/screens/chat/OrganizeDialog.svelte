<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import GripHorizontal from "@lucide/svelte/icons/grip-horizontal";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Trash from "@lucide/svelte/icons/trash";
  import { projectLabel, type ChatCategory, type ProjectInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EditableText from "$lib/ui/EditableText.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ProjectPathDialog from "./ProjectPathDialog.svelte";
  import TrashDialog from "./TrashDialog.svelte";
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
  let addingProject = $state(false);
  let trashOpen = $state(false);
  let draggingId = $state<string | null>(null);
  let dragDy = $state(0);
  let step = $state(0);
  let settling = $state(false);

  let listElement = $state<HTMLDivElement | null>(null);
  let rows: { key: string; top: number; bottom: number }[] = [];
  let dragAt = -1;
  let grab = 0;
  let pointerY = 0;
  let frame: number | null = null;

  const heightOf = (id: string) =>
    listElement?.querySelector<HTMLElement>(`[data-category="${id}"]`)?.offsetHeight ?? 0;

  const dragFrom = $derived(chat.categories.findIndex((item) => item.id === draggingId));
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

  const measure = () => {
    const nodes = Array.from(listElement?.querySelectorAll<HTMLElement>("[data-category]") ?? []);
    rows = nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { key: node.dataset.category ?? "", top: box.top, bottom: box.bottom };
    });
    dragAt = rows.findIndex((row) => row.key === draggingId);
  };

  const place = () => {
    const row = rows[dragAt];
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (!row || !first || !last) return;
    const wanted = pointerY - grab - row.top;
    dragDy = Math.max(first.top - row.top, Math.min(wanted, last.bottom - row.bottom));
  };

  const watch = () => {
    const tick = () => {
      if (draggingId === null) {
        frame = null;
        return;
      }
      measure();
      place();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  const commit = (category: ChatCategory) => {
    if (draft.trim() && draft !== category.name) void chat.renameCategory(category, draft);
    editing = null;
  };

  const sortedProjects = $derived(
    [...chat.historyProjects].sort((a, b) => projectLabel(a).localeCompare(projectLabel(b))),
  );

  const commitProject = (project: ProjectInfo) => {
    if (draft.trim()) void chat.renameProject(project, draft);
    editing = null;
  };


  const startDrag = (event: PointerEvent, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    pointerY = event.clientY;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const detach = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const begin = () => {
      step = heightOf(id) + SPACING;
      dragDy = 0;
      draggingId = id;
      measure();
      grab = rows[dragAt] ? pointerY - rows[dragAt].top : 0;
      watch();
    };

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      pointerY = move.clientY;
      if (draggingId === id) place();
    };

    const onUp = (up: Event) => {
      if (up instanceof PointerEvent && up.pointerId !== event.pointerId) return;
      detach();
      const target = draggingId === id && dropIndex >= 0 && dropIndex !== dragFrom ? dropIndex : -1;
      if (target >= 0) {
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
    if (event.pointerType === "touch") timer = setTimeout(begin, LONG_PRESS_MS);
    else begin();
  };
</script>

<CompactDialog title={t("ORGANIZE")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  <div bind:this={listElement} class="flex flex-col gap-1 {draggingId === null ? '' : 'cursor-pointer'}">
    <SelectField
      label={t("CHAT_ORDER")}
      selected={chat.chatOrder}
      options={[
        { value: "auto", label: t("CHAT_ORDER_AUTO") },
        { value: "manual", label: t("CHAT_ORDER_MANUAL") },
      ]}
      onSelect={(value) => void chat.setChatOrder(value)}
    />
    <SelectField
      label={t("DEFAULT_CATEGORY")}
      selected={chat.defaultCategory}
      options={[
        { value: "", label: t("NO_CATEGORY") },
        ...chat.categories.map((category) => ({ value: category.id, label: category.name })),
      ]}
      onSelect={(value) => void chat.setDefaultCategory(value)}
    />

    <p class="mt-1 mb-1.5 text-label-lg">{t("CATEGORIES")}</p>
    {#each chat.categories as category, index (category.id)}
      {@const dragging = draggingId === category.id}
      {@const hidden = chat.isCategoryHidden(category.id)}
      <div
        data-category={category.id}
        class="relative {draggingId === null ? '' : 'pointer-events-none'}"
        style="z-index: {dragging ? 1 : 0}"
      >
        <div
          class="flex items-center rounded-item pr-1 {dragging ? 'bg-on-surface/8' : ''}"
          style="transform: translateY({dragging ? dragDy : shiftOf(index)}px); transition: {dragging || settling
            ? 'none'
            : 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'}"
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
        <TooltipIconButton
          label={hidden ? t("SHOW") : t("HIDE")}
          class="size-8 [&_svg]:size-4"
          onclick={() => chat.toggleCategoryHidden(category.id)}
        >
          {#if hidden}
            <EyeOff />
          {:else}
            <Eye />
          {/if}
        </TooltipIconButton>
        <TooltipIconButton label={t("DELETE")} class="size-8 [&_svg]:size-4" onclick={() => (deletingCategory = category)}>
          <Trash />
        </TooltipIconButton>
        </div>
      </div>
    {/each}
    <ActionButton
      class="w-full"
      text={t("ADD_CATEGORY")}
      onclick={() => void chat.createCategory(`${t("CATEGORY")} ${chat.categories.length + 1}`)}
    />

    <p class="mt-1 mb-1.5 text-label-lg">{t("PROJECTS")}</p>
    {#each sortedProjects as project (project.projectKey)}
      {@const hidden = chat.isProjectHidden(project.projectKey)}
      <div class="flex items-center pr-1">
        <div class="min-w-0 flex-1">
          <EditableText
            value={editing === project.projectKey ? draft : projectLabel(project)}
            editing={editing === project.projectKey}
            onEdit={() => {
              editing = project.projectKey;
              draft = projectLabel(project);
            }}
            oninput={(value) => (draft = value)}
            onCommit={() => commitProject(project)}
            onCancel={() => (editing = null)}
          />
        </div>
        <TooltipIconButton
          label={t("RESET_NAME")}
          enabled={project.customName}
          class="size-8 [&_svg]:size-4"
          onclick={() => void chat.renameProject(project, "")}
        >
          <RotateCcw />
        </TooltipIconButton>
        <TooltipIconButton
          label={hidden ? t("SHOW") : t("HIDE")}
          class="size-8 [&_svg]:size-4"
          onclick={() => chat.toggleProjectHidden(project.projectKey)}
        >
          {#if hidden}
            <EyeOff />
          {:else}
            <Eye />
          {/if}
        </TooltipIconButton>
        <TooltipIconButton label={t("DELETE")} class="size-8 [&_svg]:size-4" onclick={() => (deletingProject = project)}>
          <Trash />
        </TooltipIconButton>
      </div>
    {/each}
    <ActionButton class="w-full" text={t("ADD_PROJECT")} onclick={() => (addingProject = true)} />

    {#if chat.trashEnabled}
      <ActionButton class="mt-1 w-full" text={t("TRASH")} onclick={() => (trashOpen = true)} />
    {/if}
  </div>
</CompactDialog>

{#if trashOpen}
  <TrashDialog
    {chat}
    onView={(item) => {
      void chat.openViewOnly(item);
      trashOpen = false;
      onDismiss();
    }}
    onDismiss={() => (trashOpen = false)}
  />
{/if}

{#if addingProject}
  <ProjectPathDialog
    onConfirm={(path, name) => {
      void chat.addProject(path, name || null);
      addingProject = false;
    }}
    onDismiss={() => (addingProject = false)}
  />
{/if}

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
