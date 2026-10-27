<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { openExternal } from "$lib/platform";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  interface Props {
    url: string;
    onDismiss: () => void;
  }

  const { url, onDismiss }: Props = $props();
</script>

<ConfirmDialog
  title={t("OPEN_EXTERNAL_LINK")}
  text={t("OPEN_EXTERNAL_LINK_MESSAGE", url)}
  confirmLabel={t("OPEN")}
  onConfirm={() => {
    openExternal(url);
    onDismiss();
  }}
  {onDismiss}
/>
