<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import type { ClaudeApi } from "$lib/services/claudeApi";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";

  interface Props {
    api: ClaudeApi;
    onDismiss: () => void;
  }

  const { api, onDismiss }: Props = $props();
</script>

<ConfirmDialog
  title={t("RELOAD_PLUGINS")}
  text={t("PLUGIN_RELOAD_HELD")}
  confirmLabel={t("PLUGIN_RELOAD_APPLY")}
  dismissLabel={t("PLUGIN_RELOAD_DECLINE")}
  onConfirm={() => {
    void api.reloadPlugins(true);
    onDismiss();
  }}
  {onDismiss}
/>
