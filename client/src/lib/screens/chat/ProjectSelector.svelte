<script lang="ts">
  import FolderClosed from "@lucide/svelte/icons/folder-closed";
  import Plus from "@lucide/svelte/icons/plus";
  import { projectLabel, type ProjectInfo } from "$lib/data/models";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import DropdownRow from "$lib/ui/DropdownRow.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import ProjectPathDialog from "./ProjectPathDialog.svelte";
  import type { ChatState } from "./state.svelte";
  import { tabs } from "./tabs.svelte";

  interface Props {
    projects: ProjectInfo[];
    selected: string | null;
    onSelect: (projectKey: string | null) => void;
    owner?: ChatState;
    allowAll?: boolean;
    loading?: boolean;
    shown?: string;
    following?: boolean;
    onFollow?: (() => void) | null;
    class?: string;
  }

  const {
    projects,
    selected,
    onSelect,
    owner,
    allowAll = true,
    loading = false,
    shown,
    following = false,
    onFollow = null,
    class: className = "",
  }: Props = $props();

  let open = $state(false);
  let adding = $state(false);

  const nameOf = (projectKey: string | null) => {
    if (!projectKey) return t("ALL_PROJECTS");
    if (loading) return t("LOADING");
    const project = projects.find((item) => item.projectKey === projectKey);
    return project ? projectLabel(project) : projectKey;
  };

  const label = $derived(shown ?? nameOf(selected));
</script>

{#if settings.lockedProject}
  <DropdownRow {label} icon={FolderClosed} menu={false} class={className} />
{:else}
<PopupMenu {open} matchTriggerWidth triggerClass="w-full" onOpenChange={(value) => (open = value)}>
  {#snippet trigger()}
    <DropdownRow {label} icon={FolderClosed} class={className} />
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
      void (owner ?? tabs.state).addProject(path, name || null).then((key) => {
        if (key) onSelect(key);
      });
    }}
    onDismiss={() => (adding = false)}
  />
{/if}
