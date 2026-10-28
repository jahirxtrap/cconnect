<script lang="ts">
  import AppWindow from "@lucide/svelte/icons/app-window";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import Palette from "@lucide/svelte/icons/palette";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Tag from "@lucide/svelte/icons/tag";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { isPersistentSession, projectLabel, type ChatCategory, type ProjectInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";

  interface Props {
    title: string;
    selected: boolean;
    color?: string | null;
    activity?: string | null;
    resident?: boolean;
    onOpen: () => void;
    onRename: () => void;
    onAutoRename: () => void;
    onColor: () => void;
    onOpenNewTab: () => void;
    onOpenRight?: (() => void) | null;
    onMove: (preset: string | null) => void;
    onDelete: () => void;
    trash?: boolean;
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
    color = null,
    activity = null,
    resident = false,
    onOpen,
    onRename,
    onAutoRename,
    onColor,
    onOpenNewTab,
    onOpenRight = null,
    onMove,
    onDelete,
    trash = false,
    categories = [],
    currentCategoryId = null,
    onPlace = () => {},
    onNewCategory = () => {},
    projects = [],
    currentProjectKey = null,
  }: Props = $props();

  const SPINNERS: Record<string, string> = {
    renaming: "text-purple",
    compacting: "text-blue",
    retrying: "text-yellow",
    working: "text-accent",
  };

  const DOTS: Record<string, string> = {
    waiting: "bg-orange",
    failed: "bg-red",
  };

  let menu = $state(false);
  let pointer = "mouse";

  const run = (action: () => void) => {
    menu = false;
    action();
  };

  const revealed = $derived(isTouch || selected || menu);
</script>

<div
  data-press
  class="group flex h-8 items-center gap-2 rounded-md pr-1.5 pl-2.5 transition-colors {selected
    ? 'bg-surface-variant'
    : 'hover:bg-hover'}"
  onpointerdown={(event) => (pointer = event.pointerType)}
  oncontextmenu={(event) => {
    event.preventDefault();
    if (pointer === "touch") return;
    menu = true;
  }}
  role="presentation"
>
  <span
    class="flex size-4 shrink-0 items-center justify-center"
    title={activity === "persistent" ? t("PERSISTENT_ALIVE") : undefined}
  >
    <StatusDot
      loading={!!activity && activity in SPINNERS}
      spinnerClass={activity ? SPINNERS[activity] : undefined}
      class={activity && DOTS[activity] ? DOTS[activity] : "bg-faint"}
      color={activity && DOTS[activity] ? null : color}
      ring={isPersistentSession(activity, resident)}
    />
  </span>
  <Pressable
    onclick={onOpen}
    hover={false}
    class="min-w-0 flex-1 truncate py-1.5 text-body-md {selected ? 'text-on-surface' : 'text-on-surface-variant'}"
  >
    {title}
  </Pressable>
  <div class={revealed ? "" : "opacity-0 group-hover:opacity-100"}>
    <PopupMenu open={menu} label={t("MORE_OPTIONS")} onOpenChange={(value) => (menu = value)}>
      {#snippet trigger()}
        <span
          class="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-hover hover:text-on-surface"
        >
          <EllipsisVertical size={16} />
        </span>
      {/snippet}
      <MenuItem icon={Pencil} text={t("RENAME")} onclick={() => run(onRename)} />
      <MenuItem icon={Sparkles} text={t("AUTO_RENAME")} onclick={() => run(onAutoRename)} />
      <MenuItem icon={Palette} text={t("CONVERSATION_COLOR")} onclick={() => run(onColor)} />
      <MenuItem icon={AppWindow} text={t("OPEN_IN_NEW_TAB")} onclick={() => run(onOpenNewTab)} />
      {#if onOpenRight}
        <MenuItem icon={PanelRight} text={t("OPEN_IN_RIGHT_PANE")} onclick={() => run(onOpenRight)} />
      {/if}
      <MenuSub icon={Tag} text={t("CATEGORY")}>
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
        <MenuItem icon={Plus} text={t("ADD_CATEGORY")} onclick={() => run(onNewCategory)} />
      </MenuSub>
      <MenuSub icon={FolderInput} text={t("PROJECT")}>
        {#each projects as project (project.projectKey)}
          {@const current = project.projectKey === currentProjectKey}
          <MenuItem
            text={projectLabel(project)}
            selected={current}
            onclick={() => run(() => (current || !project.path ? undefined : onMove(project.path)))}
          />
        {/each}
        <MenuItem icon={Plus} text={t("ADD_PROJECT")} onclick={() => run(() => onMove(null))} />
      </MenuSub>
      <MenuItem icon={Trash2} danger text={t(trash ? "TRASH" : "DELETE")} onclick={() => run(onDelete)} />
    </PopupMenu>
  </div>
</div>
