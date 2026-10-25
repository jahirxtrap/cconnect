<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import { isPreviewable } from "$lib/data/previewKind";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import DialogActionItem from "./DialogActionItem.svelte";
  import { FILE_ACTIONS } from "./sharedFileActions";

  interface Props {
    url: string;
    filename: string;
    onView?: (() => void) | null;
    onOpenInShared?: (() => void) | null;
    onDismiss: () => void;
  }

  const { url, filename, onView = null, onOpenInShared = null, onDismiss }: Props = $props();

  const run = (action: () => unknown) => {
    void action();
    onDismiss();
  };
</script>

<CompactDialog title={filename} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  {#if onView && isPreviewable(filename)}
    <DialogActionItem text={t("VIEW")} icon={Eye} onclick={() => run(onView)} />
  {/if}
  {#if onOpenInShared}
    <DialogActionItem text={t("OPEN_IN_SHARED")} icon={FolderArchive} onclick={() => run(onOpenInShared)} />
  {/if}
  {#each FILE_ACTIONS as action (action.label)}
    <DialogActionItem text={t(action.label)} icon={action.icon} onclick={() => run(() => action.run({ url }, filename))} />
  {/each}
</CompactDialog>
