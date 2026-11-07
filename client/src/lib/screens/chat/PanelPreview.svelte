<script lang="ts" module>
  import { navigation } from "$lib/app/navigation.svelte";
  import { panes } from "./panes.svelte";
  import type { PaneRole } from "./tabs.svelte";

  export const previewFills = (role: PaneRole) =>
    panes.busyRole === role && (panes.previewing ? navigation.preview !== null : panes.viewed !== null);
</script>

<script lang="ts">
  import { closeFilePreview, expandFilePreview, showGalleryItem } from "$lib/app/filePreview";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ProjectDiffView from "$lib/screens/project/ProjectDiffView.svelte";
  import { closeDatabaseObject, closeProjectFile, opened, openedObject } from "$lib/app/viewer.svelte";
  import DatabaseObjectView from "$lib/screens/databases/DatabaseObjectView.svelte";
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
      links={request.links}
      gallery={request.gallery}
      onPick={showGalleryItem}
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
{:else if openedObject.connection}
  <PaneSurface {role}>
    <DatabaseObjectView
      connection={openedObject.connection}
      database={openedObject.database}
      schema={openedObject.schema}
      name={openedObject.name}
      kind={openedObject.kind}
      embedded={!openedObject.full}
      onExpand={openedObject.full ? null : () => (openedObject.full = true)}
      onClose={closeDatabaseObject}
    />
  </PaneSurface>
{/if}
