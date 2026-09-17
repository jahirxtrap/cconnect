<script lang="ts">
  import FolderSymlink from "@lucide/svelte/icons/folder-symlink";
  import type { SharedFile } from "$lib/data/chatModels";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { downloadAllShared, saveSharedItemsAs } from "$lib/services/sharedFiles";
  import Button from "$lib/ui/Button.svelte";
  import Chip from "$lib/ui/Chip.svelte";
  import { fileIcon } from "$lib/ui/fileIcons";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
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

  const ACTION_CLASS = "h-8 text-body-md font-normal";

  const listed = $derived(files.map((file) => ({ ...file, url: backend.resolveShared(file.url) })));
</script>

<Collapsible
  label={plural("SHARED_COUNT", listed.length)}
  icon={FolderSymlink}
  {expanded}
  {onToggle}
>
  <OutlinedPanel>
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
    <div class="mt-2 flex flex-wrap gap-x-2 gap-y-1">
      <Button variant="outlined" class={ACTION_CLASS} onclick={() => void downloadAllShared(listed)}>
        {t("SAVE")}
      </Button>
      <Button variant="outlined" class={ACTION_CLASS} onclick={() => void saveSharedItemsAs(listed)}>
        {t("SAVE_AS")}
      </Button>
    </div>
  </OutlinedPanel>
</Collapsible>
