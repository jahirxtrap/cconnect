<script lang="ts">
  import Bell from "@lucide/svelte/icons/bell";
  import Clock from "@lucide/svelte/icons/clock";
  import History from "@lucide/svelte/icons/history";
  import Languages from "@lucide/svelte/icons/languages";
  import Minimize2 from "@lucide/svelte/icons/minimize-2";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Palette from "@lucide/svelte/icons/palette";
  import Server from "@lucide/svelte/icons/server";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Sun from "@lucide/svelte/icons/sun";
  import Type from "@lucide/svelte/icons/type";
  import { navigation } from "$lib/app/navigation.svelte";
  import Screen from "$lib/app/Screen.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { ACCENTS } from "$lib/design/accents";
  import { theme, type FontStyle, type ThemeMode } from "$lib/design/theme.svelte";
  import { i18n, t, type Locale } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import { address, backend } from "$lib/services/backend.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import AboutGroup from "./AboutGroup.svelte";
  import AccentDialog from "./AccentDialog.svelte";
  import EnvironmentsDialog from "./EnvironmentsDialog.svelte";
  import NotificationsDialog from "./NotificationsDialog.svelte";

  type Dialog = "theme" | "language" | "font" | "accent" | "environments" | "notifications" | "reset";

  const THEME_OPTIONS = [
    { value: "system", label: t("THEME_SYSTEM") },
    { value: "light", label: t("THEME_LIGHT") },
    { value: "dark", label: t("THEME_DARK") },
  ];

  const LOCALE_OPTIONS = [
    { value: "system", label: t("LANGUAGE_SYSTEM") },
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
  ];

  const FONT_OPTIONS = [
    { value: "flat", label: t("FONT_FLAT") },
    { value: "color", label: t("FONT_COLOR") },
    { value: "system", label: t("FONT_SYSTEM") },
  ];

  let dialog = $state<Dialog | null>(null);

  const themeIcon = $derived(
    theme.mode === "light" ? Sun : theme.mode === "dark" ? Moon : Monitor,
  );

  const label = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  const activeNotifications = $derived(
    [settings.notifyInteraction, settings.notifyTaskDone].filter(Boolean).length,
  );

  const reset = () => {
    theme.setMode("system");
    theme.setAccent(DEFAULT_ACCENT);
    theme.setFontStyle("flat");
    i18n.set("system");
    dialog = null;
  };

  const DEFAULT_ACCENT = 4;
</script>

<Screen title={t("SETTINGS")}>
  <div class="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
    <SettingsGroup label={t("SETTINGS_APPEARANCE")}>
      <PreferenceRow
        icon={themeIcon}
        title={t("THEME")}
        summary={label(THEME_OPTIONS, theme.mode)}
        onclick={() => (dialog = "theme")}
      />
      <PreferenceRow
        icon={Languages}
        title={t("LANGUAGE")}
        summary={label(LOCALE_OPTIONS, i18n.locale)}
        onclick={() => (dialog = "language")}
      />
      <PreferenceRow
        icon={Palette}
        title={t("ACCENT")}
        summary={ACCENTS[theme.accentIndex]?.name}
        onclick={() => (dialog = "accent")}
      >
        {#snippet trailing()}
          <span class="size-4 rounded-full" style="background: {theme.accent}"></span>
        {/snippet}
      </PreferenceRow>
      <PreferenceRow
        icon={Type}
        title={t("FONT")}
        summary={label(FONT_OPTIONS, theme.fontStyle)}
        onclick={() => (dialog = "font")}
      />
      <PreferenceRow
        icon={Clock}
        title={t("SHOW_TIMESTAMPS")}
        summary={t("SHOW_TIMESTAMPS_SUMMARY")}
        onclick={() => (settings.showTimestamps = !settings.showTimestamps)}
      >
        {#snippet trailing()}
          <CompactSwitch
            checked={settings.showTimestamps}
            onCheckedChange={(value) => (settings.showTimestamps = value)}
          />
        {/snippet}
      </PreferenceRow>
    </SettingsGroup>

    <SettingsGroup label={t("BACKGROUND_GROUP")}>
      <PreferenceRow
        icon={Bell}
        title={t("NOTIFICATIONS")}
        summary={t("NOTIFICATIONS_STATE", activeNotifications)}
        onclick={() => (dialog = "notifications")}
      />
      {#if isTauri}
        <PreferenceRow
          icon={Minimize2}
          title={t("MINIMIZE_TO_TRAY")}
          summary={t("MINIMIZE_TO_TRAY_SUMMARY")}
          onclick={() => (settings.minimizeToTray = !settings.minimizeToTray)}
        >
          {#snippet trailing()}
            <CompactSwitch
              checked={settings.minimizeToTray}
              onCheckedChange={(value) => (settings.minimizeToTray = value)}
            />
          {/snippet}
        </PreferenceRow>
      {/if}
    </SettingsGroup>

    <SettingsGroup label={t("SETTINGS_CONNECTIVITY")}>
      <PreferenceRow
        icon={Server}
        title={t("ENVIRONMENTS")}
        summary={backend.active ? `${backend.active.name} • ${address(backend.active)}` : t("NO_ENVIRONMENTS")}
        onclick={() => (dialog = "environments")}
      />
      <PreferenceRow
        icon={SquareTerminal}
        title={t("SSH_HOSTS")}
        summary={t("SSH_HOSTS_SUMMARY")}
        onclick={() => navigation.openSshHosts()}
      />
    </SettingsGroup>

    <SettingsGroup>
      <PreferenceRow
        icon={History}
        title={t("RESET_SETTINGS")}
        summary={t("RESET_SETTINGS_SUMMARY")}
        onclick={() => (dialog = "reset")}
      />
    </SettingsGroup>

    <AboutGroup />
  </div>
</Screen>

{#if dialog === "theme"}
  <SelectDialog
    title={t("THEME")}
    options={THEME_OPTIONS}
    selected={theme.mode}
    onSelect={(value) => theme.setMode(value as ThemeMode)}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "language"}
  <SelectDialog
    title={t("LANGUAGE")}
    options={LOCALE_OPTIONS}
    selected={i18n.locale}
    onSelect={(value) => i18n.set(value as Locale)}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "font"}
  <SelectDialog
    title={t("FONT")}
    options={FONT_OPTIONS}
    selected={theme.fontStyle}
    onSelect={(value) => theme.setFontStyle(value as FontStyle)}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "accent"}
  <AccentDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "environments"}
  <EnvironmentsDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "notifications"}
  <NotificationsDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "reset"}
  <ConfirmDialog
    title={t("RESET_SETTINGS")}
    text={t("RESET_SETTINGS_SUMMARY")}
    confirmLabel={t("CONFIRM")}
    onConfirm={reset}
    onDismiss={() => (dialog = null)}
  />
{/if}
