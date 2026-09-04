<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import History from "@lucide/svelte/icons/history";
  import Upload from "@lucide/svelte/icons/upload";
  import { exportSettings, importSettings } from "$lib/data/backup";
  import { DEFAULT_ACCENT_INDEX } from "$lib/design/accents";
  import { theme } from "$lib/design/theme.svelte";
  import { i18n, t } from "$lib/i18n/index.svelte";
  import { settingsApi } from "$lib/services/settingsApi";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import BackupDialog from "./BackupDialog.svelte";
  import { useSettingsDialog } from "./useSettingsDialog.svelte";

  interface Props {
    onChanged: () => void;
  }

  const { onChanged }: Props = $props();

  type Dialog = "export" | "import" | "reset";

  let dialog = $state<Dialog | null>(null);
  let backup = $state("");

  useSettingsDialog("recovery", (target) => {
    if (target === "export") backup = exportSettings();
    dialog = target as Dialog;
  });

  const reset = () => {
    theme.setMode("system");
    theme.setDynamicColor(false);
    theme.setAccent(DEFAULT_ACCENT_INDEX);
    theme.setFontStyle("flat");
    i18n.set("system");
    void settingsApi.reset();
    onChanged();
    dialog = null;
  };
</script>

<SettingsGroup label={t("SETTINGS_RECOVERY")}>
  <PreferenceRow
    icon={Upload}
    title={t("EXPORT_SETTINGS")}
    summary={t("EXPORT_SETTINGS_SUMMARY")}
    onclick={() => {
      backup = exportSettings();
      dialog = "export";
    }}
  />
  <PreferenceRow
    icon={Download}
    title={t("IMPORT_SETTINGS")}
    summary={t("IMPORT_SETTINGS_SUMMARY")}
    onclick={() => (dialog = "import")}
  />
  <PreferenceRow
    icon={History}
    title={t("RESET_SETTINGS")}
    summary={t("RESET_SETTINGS_SUMMARY")}
    onclick={() => (dialog = "reset")}
  />
</SettingsGroup>

{#if dialog === "reset"}
  <ConfirmDialog
    title={t("RESET_SETTINGS")}
    text={t("RESET_SETTINGS_CONFIRM")}
    confirmLabel={t("ACCEPT")}
    onConfirm={reset}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "export"}
  <BackupDialog mode="export" payload={backup} onDismiss={() => (dialog = null)} />
{:else if dialog === "import"}
  <BackupDialog
    mode="import"
    onImport={(raw) => {
      if (!importSettings(raw)) return false;
      onChanged();
      return true;
    }}
    onDismiss={() => (dialog = null)}
  />
{/if}
