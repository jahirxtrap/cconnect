<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Replace from "@lucide/svelte/icons/replace";
  import SkipForward from "@lucide/svelte/icons/skip-forward";
  import { plural, t } from "$lib/i18n/index.svelte";
  import type { ClashPolicy } from "$lib/services/sharedApi";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import DialogActionItem from "./DialogActionItem.svelte";

  interface Props {
    names: string[];
    onChoose: (policy: ClashPolicy) => void;
    onDismiss: () => void;
  }

  const { names, onChoose, onDismiss }: Props = $props();

  const subtitle = $derived(names.length > 1 ? plural("FILE_COUNT", names.length) : names[0]);
</script>

<CompactDialog title={t("CLASH_TITLE")} {subtitle} description={t("CLASH_HINT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  <DialogActionItem text={t("CLASH_REPLACE")} icon={Replace} onclick={() => onChoose("replace")} />
  <DialogActionItem text={t("CLASH_SKIP")} icon={SkipForward} onclick={() => onChoose("skip")} />
  <DialogActionItem text={t("CLASH_KEEP")} icon={Copy} onclick={() => onChoose("keep")} />
</CompactDialog>
