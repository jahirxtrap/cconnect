<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import { chatList } from "$lib/data/chatList.svelte";
  import type { ProjectInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";

  interface Props {
    selected: string | null;
    onSelect: (projectKey: string | null) => void;
    class?: string;
  }

  const { selected, onSelect, class: className = "" }: Props = $props();

  let open = $state(false);

  const projectLabel = (project: ProjectInfo) => project.name ?? project.path ?? project.projectKey;

  const label = $derived.by(() => {
    if (selected === null) return t("ALL_PROJECTS");
    const project = chatList.projects.find((item) => item.projectKey === selected);
    return project ? projectLabel(project) : selected;
  });
</script>

<PopupMenu {open} matchTriggerWidth onOpenChange={(value) => (open = value)}>
  {#snippet trigger()}
    <span class="flex w-full cursor-pointer items-center rounded-xs px-2 py-2.5 {className}">
      <FolderOpen size={18} class="shrink-0 text-accent" />
      <span class="ml-2 min-w-0 flex-1 truncate text-left text-label-lg">{label}</span>
      <ChevronDown size={24} class="shrink-0 text-on-surface-variant" />
    </span>
  {/snippet}
  <MenuItem
    text={t("ALL_PROJECTS")}
    selected={selected === null}
    onclick={() => {
      onSelect(null);
      open = false;
    }}
  />
  {#each chatList.projects as project (project.projectKey)}
    <MenuItem
      text={projectLabel(project)}
      selected={selected === project.projectKey}
      onclick={() => {
        onSelect(project.projectKey);
        open = false;
      }}
    />
  {/each}
</PopupMenu>
