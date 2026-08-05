<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import Eye from "@lucide/svelte/icons/eye";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import { isPreviewable } from "$lib/data/previewKind";
  import { t } from "$lib/i18n/index.svelte";
  import { downloadShared, openSharedExternally, saveSharedAs } from "$lib/services/sharedFiles";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import DialogActionItem from "./DialogActionItem.svelte";

  interface Props {
    url: string;
    filename: string;
    onView?: (() => void) | null;
    onOpenInFiles?: (() => void) | null;
    onDismiss: () => void;
  }

  const { url, filename, onView = null, onOpenInFiles = null, onDismiss }: Props = $props();

  const run = (action: () => void) => {
    onDismiss();
    action();
  };
</script>

<CompactDialog title={filename} padded={false} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  {#if onView && isPreviewable(filename)}
    <DialogActionItem text={t("VIEW")} icon={Eye} onclick={() => run(onView)} />
  {/if}
  {#if onOpenInFiles}
    <DialogActionItem text={t("OPEN_IN_FILES")} icon={FolderArchive} onclick={() => run(onOpenInFiles)} />
  {/if}
  <DialogActionItem text={t("SAVE")} icon={Download} onclick={() => run(() => void downloadShared(url, filename))} />
  <DialogActionItem text={t("SAVE_AS")} icon={Save} onclick={() => run(() => void saveSharedAs(url, filename))} />
  <DialogActionItem
    text={t("SHARE")}
    icon={Share2}
    onclick={() => run(() => void openSharedExternally(url, filename))}
  />
</CompactDialog>
