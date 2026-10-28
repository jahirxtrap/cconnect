<script lang="ts">
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import type { ProjectInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ProjectSelector from "./ProjectSelector.svelte";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState | null;
    query: string;
    onQuery: (value: string) => void;
    projects: ProjectInfo[];
    project: string | null;
    projectsLoading: boolean;
    onProject: (projectKey: string | null) => void;
    allProjects?: boolean;
    organizable: boolean;
    onOrganize: () => void;
  }

  const {
    chat,
    query,
    onQuery,
    projects,
    project,
    projectsLoading,
    onProject,
    allProjects = true,
    organizable,
    onOrganize,
  }: Props = $props();
</script>

<SearchBar value={query} oninput={onQuery} placeholder={t("SEARCH")} class="mx-2" />

<div class="mt-1.5 flex shrink-0 items-center px-2">
  <div class="min-w-0 flex-1">
    <ProjectSelector
      {projects}
      selected={project}
      owner={chat ?? undefined}
      loading={projectsLoading}
      allowAll={allProjects}
      onSelect={onProject}
    />
  </div>
  <TooltipIconButton label={t("ORGANIZE")} enabled={organizable} onclick={onOrganize}>
    <Settings2 />
  </TooltipIconButton>
</div>
