<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import DialogActionItem from "./DialogActionItem.svelte";
  import { FILE_ACTION_LOOK, inFileOrder, type FileActionEntry } from "./sharedFileActions";

  interface Props {
    filename: string;
    actions: FileActionEntry[];
    onDismiss: () => void;
  }

  const { filename, actions, onDismiss }: Props = $props();

  const run = (action: () => unknown) => {
    void action();
    onDismiss();
  };
</script>

<CompactDialog title={filename} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  {#each inFileOrder(actions) as action (action.id)}
    {@const look = FILE_ACTION_LOOK[action.id]}
    <DialogActionItem text={t(look.label)} icon={look.icon} onclick={() => run(action.run)} />
  {/each}
</CompactDialog>
