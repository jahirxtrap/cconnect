<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FolderClosed from "@lucide/svelte/icons/folder-closed";
  import Plus from "@lucide/svelte/icons/plus";
  import { projectLabel, type ProjectInfo } from "$lib/data/models";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import ProjectPathDialog from "./ProjectPathDialog.svelte";
  import { tabs } from "./tabs.svelte";

  interface Props {
    projects: ProjectInfo[];
    selected: string | null;
    onSelect: (projectKey: string | null) => void;
    allowAll?: boolean;
    shown?: string;
    following?: boolean;
    onFollow?: (() => void) | null;
    class?: string;
  }

  const {
    projects,
    selected,
    onSelect,
    allowAll = true,
    shown,
    following = false,
    onFollow = null,
    class: className = "",
  }: Props = $props();

  let open = $state(false);
  let adding = $state(false);

  const nameOf = (projectKey: string | null) => {
    if (!projectKey) return t("ALL_PROJECTS");
    const project = projects.find((item) => item.projectKey === projectKey);
    return project ? projectLabel(project) : projectKey;
  };

  const label = $derived(shown ?? nameOf(selected));
</script>

{#if settings.lockedProject}
  <span class="flex w-full items-center rounded-item px-2 py-2 {className}">
    <FolderClosed size={16} class="shrink-0 text-accent" />
    <span class="ml-2 min-w-0 flex-1 truncate text-left text-body-md">{label}</span>
  </span>
{:else}
<PopupMenu {open} matchTriggerWidth triggerClass="w-full" onOpenChange={(value) => (open = value)}>
  {#snippet trigger()}
    <span
      class="flex w-full cursor-pointer items-center rounded-item px-2 py-2 transition-colors hover:bg-on-surface/6 {className}"
    >
      <FolderClosed size={16} class="shrink-0 text-accent" />
      <span class="ml-2 min-w-0 flex-1 truncate text-left text-body-md">{label}</span>
      <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
    </span>
  {/snippet}
  {#if onFollow}
    <MenuItem
      text={t("FOLLOW_CHAT")}
      selected={following}
      onclick={() => {
        onFollow();
        open = false;
      }}
    />
  {/if}
  {#if allowAll}
    <MenuItem
      text={t("ALL_PROJECTS")}
      selected={!following && selected === null}
      onclick={() => {
        onSelect(null);
        open = false;
      }}
    />
  {/if}
  {#each projects as project (project.projectKey)}
    <MenuItem
      text={projectLabel(project)}
      selected={!following && selected === project.projectKey}
      onclick={() => {
        onSelect(project.projectKey);
        open = false;
      }}
    />
  {/each}
  <MenuItem
    text={t("ADD_PROJECT")}
    onclick={() => {
      adding = true;
      open = false;
    }}
  >
    {#snippet trailing()}
      <Plus size={16} class="shrink-0 text-on-surface-variant" />
    {/snippet}
  </MenuItem>
</PopupMenu>
{/if}

{#if adding}
  <ProjectPathDialog
    onConfirm={(path, name) => {
      adding = false;
      void tabs.state.addProject(path, name || null).then((key) => {
        if (key) onSelect(key);
      });
    }}
    onDismiss={() => (adding = false)}
  />
{/if}
