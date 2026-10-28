<script lang="ts" module>
  import { navigation } from "$lib/app/navigation.svelte";
  import { opened } from "$lib/screens/project/openFile.svelte";
  import { panes } from "./panes.svelte";
  import type { PaneRole } from "./tabs.svelte";

  export const previewFills = (role: PaneRole) =>
    panes.busyRole === role && (panes.previewing ? navigation.preview !== null : !!(opened.project && opened.path));
</script>

<script lang="ts">
  import { closeFilePreview, expandFilePreview } from "$lib/app/filePreview";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ProjectDiffView from "$lib/screens/project/ProjectDiffView.svelte";
  import { closeProjectFile } from "$lib/screens/project/openFile.svelte";
  import FilePreview from "$lib/screens/shared/FilePreview.svelte";
  import PaneSurface from "./PaneSurface.svelte";

  interface Props {
    role: PaneRole;
  }

  const { role }: Props = $props();
</script>

{#if panes.previewing && navigation.preview}
  {@const request = navigation.preview}
  <PaneSurface {role}>
    <FilePreview
      embedded
      url={request.url}
      filename={request.name}
      forcedKind={request.kind}
      onDelete={request.onDelete}
      onClose={closeFilePreview}
      onExpand={expandFilePreview}
    />
  </PaneSurface>
{:else if opened.project && opened.path}
  {@const project = chatListFor(backend.active)?.projects.find((item) => item.projectKey === opened.project)}
  <PaneSurface {role}>
    <ProjectDiffView
      projectKey={opened.project}
      path={opened.path}
      status={opened.status}
      root={project?.path ?? null}
      embedded={!opened.full}
      onExpand={opened.full ? null : () => (opened.full = true)}
      onClose={closeProjectFile}
    />
  </PaneSurface>
{/if}
