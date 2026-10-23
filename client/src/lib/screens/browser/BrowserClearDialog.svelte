<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import { deviceBrowser } from "./deviceBrowser.svelte";

  interface Props {
    site?: string | null;
    onDismiss: () => void;
    onCleared?: () => void;
  }

  const { site = null, onDismiss, onCleared }: Props = $props();

  const clear = async () => {
    onDismiss();
    if (site) await deviceBrowser.clearSite(site).catch(() => undefined);
    else await deviceBrowser.clearData().catch(() => undefined);
    onCleared?.();
  };
</script>

<ConfirmDialog
  title={t(site ? "BROWSER_SITE_CLEAR" : "BROWSER_DATA_CLEAR_ALL")}
  text={site ? t("BROWSER_SITE_CLEAR_CONFIRM", site) : t("BROWSER_DATA_CLEAR_CONFIRM")}
  confirmLabel={t("BROWSER_DATA_CLEAR")}
  danger
  onConfirm={() => void clear()}
  {onDismiss}
/>
