<script lang="ts">
  import FolderSymlink from "@lucide/svelte/icons/folder-symlink";
  import type { SharedFile } from "$lib/data/chatModels";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { contextServer } from "$lib/services/serverContext";
  import { downloadAllShared, saveSharedItemsAs } from "$lib/services/sharedFiles";
  import Button from "$lib/ui/Button.svelte";
  import Chip from "$lib/ui/Chip.svelte";
  import { fileIcon } from "$lib/ui/fileIcons";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    files: SharedFile[];
    onSharedLink?: ((url: string, filename: string) => void) | null;
    onSharedMenu?: ((url: string, filename: string) => void) | null;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
  }

  const {
    files,
    onSharedLink = null,
    onSharedMenu = null,
    expanded = null,
    onToggle = null,
  }: Props = $props();

  const server = contextServer();
  const listed = $derived(files.map((file) => ({ ...file, url: backend.resolveShared(file.url, server()) })));
</script>

<Collapsible
  label={plural("SHARED_COUNT", listed.length)}
  icon={FolderSymlink}
  {expanded}
  {onToggle}
>
  <div class="flex flex-wrap items-center gap-1.5">
    {#each listed as file (file.url)}
      <Chip
        name={file.name}
        icon={fileIcon(file.name)}
        onclick={() => onSharedLink?.(file.url, file.name)}
        onmenu={onSharedMenu ? () => onSharedMenu(file.url, file.name) : null}
      />
    {/each}
  </div>
  <div class="mt-2.5 flex flex-wrap gap-2">
    <Button variant="outlined" small onclick={() => void downloadAllShared(listed)}>
      {t("SAVE")}
    </Button>
    <Button variant="outlined" small onclick={() => void saveSharedItemsAs(listed)}>
      {t("SAVE_AS")}
    </Button>
  </div>
</Collapsible>
