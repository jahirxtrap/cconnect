<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Plus from "@lucide/svelte/icons/plus";
  import { projectLabel, type ChatCategory, type ProjectInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";

  interface Props {
    title: string;
    selected: boolean;
    activity?: string | null;
    onOpen: () => void;
    onRename: () => void;
    onAutoRename: () => void;
    onColor: () => void;
    onOpenNewTab: () => void;
    onMove: (preset: string | null) => void;
    onDelete: () => void;
    categories?: ChatCategory[];
    currentCategoryId?: string | null;
    onPlace?: (categoryId: string | null) => void;
    onNewCategory?: () => void;
    projects?: ProjectInfo[];
    currentProjectKey?: string | null;
  }

  const {
    title,
    selected,
    activity = null,
    onOpen,
    onRename,
    onAutoRename,
    onColor,
    onOpenNewTab,
    onMove,
    onDelete,
    categories = [],
    currentCategoryId = null,
    onPlace = () => {},
    onNewCategory = () => {},
    projects = [],
    currentProjectKey = null,
  }: Props = $props();

  let menu = $state(false);
  let pointer = "mouse";

  const run = (action: () => void) => {
    menu = false;
    action();
  };
</script>

<div
  class="group flex items-center rounded-item pr-1 transition-colors {selected
    ? 'bg-accent/14 hover:bg-accent/21'
    : 'hover:bg-on-surface/8'}"
  onpointerdown={(event) => (pointer = event.pointerType)}
  oncontextmenu={(event) => {
    event.preventDefault();
    if (pointer === "touch") return;
    menu = true;
  }}
  role="presentation"
>
  <Pressable
    onclick={onOpen}
    hover={false}
    class="min-w-0 flex-1 truncate px-2 py-2 text-body-md {selected ? 'font-semibold text-accent' : ''}"
  >
    {title}
  </Pressable>
  {#if activity === "waiting"}
    <span class="flex shrink-0 items-center"><StatusDot class="bg-orange" box={16} dot={9} /></span>
  {:else if activity === "failed"}
    <span class="flex shrink-0 items-center"><StatusDot class="bg-red" box={16} dot={9} /></span>
  {:else if activity === "renaming"}
    <span class="inline-flex size-4 shrink-0 items-center justify-center">
      <LoadingIndicator size={9} fill class="text-purple" />
    </span>
  {:else if activity === "compacting"}
    <span class="inline-flex size-4 shrink-0 items-center justify-center">
      <LoadingIndicator size={9} fill class="text-blue" />
    </span>
  {:else if activity === "slow"}
    <span class="inline-flex size-4 shrink-0 items-center justify-center">
      <LoadingIndicator size={9} fill class="text-yellow" />
    </span>
  {:else if activity === "working"}
    <span class="inline-flex size-4 shrink-0 items-center justify-center">
      <LoadingIndicator size={9} fill />
    </span>
  {/if}
  <div>
    <PopupMenu open={menu} label={t("MORE_OPTIONS")} onOpenChange={(value) => (menu = value)}>
      {#snippet trigger()}
        <span
          class="inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/10"
        >
          <EllipsisVertical size={16} />
        </span>
      {/snippet}
      <MenuItem text={t("RENAME")} onclick={() => run(onRename)} />
      <MenuItem text={t("AUTO_RENAME")} onclick={() => run(onAutoRename)} />
      <MenuItem text={t("CONVERSATION_COLOR")} onclick={() => run(onColor)} />
      <MenuItem text={t("OPEN_IN_NEW_TAB")} onclick={() => run(onOpenNewTab)} />
      <MenuSub text={t("CATEGORY")}>
        {#if categories.length}
          <MenuItem
            text={t("NO_CATEGORY")}
            selected={currentCategoryId === null}
            onclick={() => run(() => onPlace(null))}
          />
          {#each categories as category (category.id)}
            <MenuItem
              text={category.name}
              selected={currentCategoryId === category.id}
              onclick={() => run(() => onPlace(category.id))}
            />
          {/each}
        {/if}
        <MenuItem text={t("ADD_CATEGORY")} onclick={() => run(onNewCategory)}>
          {#snippet trailing()}
            <Plus size={16} class="shrink-0 text-on-surface-variant" />
          {/snippet}
        </MenuItem>
      </MenuSub>
      <MenuSub text={t("PROJECT")}>
        {#each projects as project (project.projectKey)}
          {@const current = project.projectKey === currentProjectKey}
          <MenuItem
            text={projectLabel(project)}
            selected={current}
            onclick={() => run(() => (current || !project.path ? undefined : onMove(project.path)))}
          />
        {/each}
        <MenuItem text={t("ADD_PROJECT")} onclick={() => run(() => onMove(null))}>
          {#snippet trailing()}
            <Plus size={16} class="shrink-0 text-on-surface-variant" />
          {/snippet}
        </MenuItem>
      </MenuSub>
      <MenuItem text={t("DELETE")} onclick={() => run(onDelete)} />
    </PopupMenu>
  </div>
</div>
