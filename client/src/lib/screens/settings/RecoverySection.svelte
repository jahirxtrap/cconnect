<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import History from "@lucide/svelte/icons/history";
  import Upload from "@lucide/svelte/icons/upload";
  import { importSettings } from "$lib/data/backup";
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import { DEFAULT_ACCENT } from "$lib/design/accents";
  import { DEFAULT_FONTS } from "$lib/design/fonts";
  import { FONT_KINDS, THEME_KINDS } from "$lib/design/packs/schema";
  import { theme } from "$lib/design/theme.svelte";
  import { DEFAULT_TERMINAL, DEFAULT_THEMES } from "$lib/design/themes";
  import { i18n, t } from "$lib/i18n/index.svelte";
  import { driveAvailable } from "$lib/services/drive/config";
  import { settingsApi } from "$lib/services/settingsApi";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import GoogleDriveIcon from "$lib/ui/GoogleDriveIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import BackupDialog from "./BackupDialog.svelte";
  import DriveDialog from "./DriveDialog.svelte";
  import { useSettingsDialog } from "./useSettingsDialog.svelte";

  interface Props {
    onChanged: () => void;
  }

  const { onChanged }: Props = $props();

  type Dialog = "export" | "import" | "reset" | "drive";

  let dialog = $state<Dialog | null>(null);

  useSettingsDialog("recovery", (target) => (dialog = target as Dialog));

  const reset = () => {
    theme.setMode("system");
    theme.setTerminal(DEFAULT_TERMINAL);
    for (const kind of THEME_KINDS) theme.setTheme(kind, DEFAULT_THEMES[kind]);
    chatBackground.reset();
    theme.setAccent(DEFAULT_ACCENT);
    for (const kind of FONT_KINDS) theme.setFont(kind, DEFAULT_FONTS[kind]);
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
    onclick={() => (dialog = "export")}
  />
  <PreferenceRow
    icon={Download}
    title={t("IMPORT_SETTINGS")}
    summary={t("IMPORT_SETTINGS_SUMMARY")}
    onclick={() => (dialog = "import")}
  />
  {#if driveAvailable()}
    <PreferenceRow
      icon={GoogleDriveIcon}
      title={t("DRIVE_BACKUP")}
      summary={t("DRIVE_BACKUP_SUMMARY")}
      onclick={() => (dialog = "drive")}
    />
  {/if}
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
    danger
    onConfirm={reset}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "export"}
  <BackupDialog mode="export" onDismiss={() => (dialog = null)} />
{:else if dialog === "drive"}
  <DriveDialog {onChanged} onDismiss={() => (dialog = null)} />
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
