<script lang="ts">
  import BatteryCharging from "@lucide/svelte/icons/battery-charging";
  import Bell from "@lucide/svelte/icons/bell";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Clock from "@lucide/svelte/icons/clock";
  import History from "@lucide/svelte/icons/history";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import Languages from "@lucide/svelte/icons/languages";
  import Minimize2 from "@lucide/svelte/icons/minimize-2";
  import Moon from "@lucide/svelte/icons/moon";
  import Palette from "@lucide/svelte/icons/palette";
  import Server from "@lucide/svelte/icons/server";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Sun from "@lucide/svelte/icons/sun";
  import SunMoon from "@lucide/svelte/icons/sun-moon";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Type from "@lucide/svelte/icons/type";
  import Download from "@lucide/svelte/icons/download";
  import Upload from "@lucide/svelte/icons/upload";
  import { navigation } from "$lib/app/navigation.svelte";
  import { exportSettings, importSettings } from "$lib/data/backup";
  import { desktop } from "$lib/platform/desktop.svelte";
  import Screen from "$lib/app/Screen.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { ACCENTS, DYNAMIC_ACCENT, DEFAULT_ACCENT_INDEX } from "$lib/design/accents";
  import { theme, type FontStyle, type ThemeMode } from "$lib/design/theme.svelte";
  import { i18n, t, type Locale } from "$lib/i18n/index.svelte";
  import { isDesktop, isTouch } from "$lib/platform";
  import { androidBackground } from "$lib/platform/androidBackground";
  import { address, backend } from "$lib/services/backend.svelte";
  import { notifier } from "$lib/services/notifier.svelte";
  import { settingsApi } from "$lib/services/settingsApi";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog, { type SelectOption } from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChangelogDialog from "$lib/ui/ChangelogDialog.svelte";
  import { claudeChangelog } from "$lib/services/githubApi";
  import AboutGroup from "./AboutGroup.svelte";
  import BackupDialog from "./BackupDialog.svelte";
  import AccentDialog from "./AccentDialog.svelte";
  import EnvironmentsDialog from "./EnvironmentsDialog.svelte";
  import LocalServerGroup from "./LocalServerGroup.svelte";
  import NotificationsDialog from "./NotificationsDialog.svelte";
  import ServerGroup from "./ServerGroup.svelte";
  import ShortcutsDialog from "./ShortcutsDialog.svelte";

  type Dialog =
    | "theme"
    | "language"
    | "font"
    | "accent"
    | "environments"
    | "notifications"
    | "reset"
    | "export"
    | "import"
    | "shortcuts";

  let cliChangelog = $state<string | null | undefined>(undefined);

  const themeOptions = $derived([
    { value: "system", label: t("THEME_SYSTEM") },
    { value: "light", label: t("THEME_LIGHT") },
    { value: "dark", label: t("THEME_DARK") },
  ]);

  const localeOptions = $derived([
    { value: "system", label: t("LANGUAGE_SYSTEM") },
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
  ]);

  const FONT_FAMILIES: Record<FontStyle, string> = {
    system: "system-ui, sans-serif",
    flat: '"CConnect Flat", system-ui, sans-serif',
    color: '"CConnect Color", system-ui, sans-serif',
  };

  const fontOptions = $derived([
    { value: "system", label: t("FONT_SYSTEM"), font: FONT_FAMILIES.system },
    { value: "flat", label: t("FONT_FLAT"), font: FONT_FAMILIES.flat },
    { value: "color", label: t("FONT_COLOR"), font: FONT_FAMILIES.color },
  ]);

  let dialog = $state<Dialog | null>(null);
  let refreshTick = $state(0);
  let refreshing = $state(false);
  let backup = $state("");

  const tick = $derived(refreshTick + desktop.refreshTick);

  const refresh = () => {
    refreshing = true;
    refreshTick++;
  };

  $effect(() => {
    if (tick === 0) return;
    void serverStatus.refresh();
  });
  let serverSection = $state<HTMLDivElement | null>(null);
  let aboutSection = $state<HTMLDivElement | null>(null);
  let flashed = $state<string | null>(null);

  const FLASH_MS = 880;

  $effect(() => {
    const target = navigation.settingsHighlight;
    if (!target) return;
    const section = target === "cli" ? serverSection : aboutSection;
    if (!section) return;
    section.scrollIntoView({ block: "start", behavior: "smooth" });
    flashed = target;
    const timer = setTimeout(() => {
      flashed = null;
      navigation.settingsHighlight = null;
    }, FLASH_MS);
    return () => clearTimeout(timer);
  });

  const themeIcon = $derived(theme.mode === "light" ? Sun : theme.mode === "dark" ? Moon : SunMoon);

  const label = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  const activeNotifications = $derived(
    [settings.notifyInteraction, settings.notifyTaskDone].filter(Boolean).length,
  );

  let batteryIgnored = $state(androidBackground()?.batteryOptimizationIgnored() ?? false);

  $effect(() => {
    const bridge = androidBackground();
    if (!bridge) return;
    const refresh = () => (batteryIgnored = bridge.batteryOptimizationIgnored());
    const target = window as unknown as { __cconnectResume?: () => void };
    target.__cconnectResume = refresh;
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      delete target.__cconnectResume;
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  });

  const reset = () => {
    theme.setMode("system");
    theme.setDynamicColor(false);
    theme.setAccent(DEFAULT_ACCENT_INDEX);
    theme.setFontStyle("flat");
    i18n.set("system");
    void settingsApi.reset();
    refreshTick++;
    dialog = null;
  };
</script>

<Screen title={t("SETTINGS")} {refreshing} onRefresh={refresh}>
  {#snippet actions()}
    {#if !isTouch}
      <TooltipIconButton label={t("REFRESH")} shortcut="window.refresh" onclick={refresh}>
        <RotateCw size={20} />
      </TooltipIconButton>
    {/if}
  {/snippet}
  <div class="flex w-full flex-col px-4 pb-4">
    <SettingsGroup label={t("SETTINGS_CLIENT")}>
      <PreferenceRow
        icon={themeIcon}
        title={t("THEME")}
        summary={label(themeOptions, theme.mode)}
        onclick={() => (dialog = "theme")}
      />
      <PreferenceRow
        icon={Languages}
        title={t("LANGUAGE")}
        summary={label(localeOptions, i18n.locale)}
        onclick={() => (dialog = "language")}
      />
      <PreferenceRow
        icon={Palette}
        title={t("ACCENT")}
        summary={theme.dynamicColor && theme.systemAccent ? t("ACCENT_DYNAMIC") : ACCENTS[theme.accentIndex]?.name}
        onclick={() => (dialog = "accent")}
      >
        {#snippet trailing()}
          <span class="flex h-7 w-9 items-center justify-center"><span class="size-5 rounded-full" style="background: {theme.appAccent}"></span></span>
        {/snippet}
      </PreferenceRow>
      <PreferenceRow
        icon={Type}
        title={t("FONT")}
        summary={label(fontOptions, theme.fontStyle)}
        onclick={() => (dialog = "font")}
      >
        {#snippet trailing()}
          <span class="flex h-7 w-9 items-center justify-center text-[22px]" data-font={theme.fontStyle}>😃</span>
        {/snippet}
      </PreferenceRow>
      <PreferenceRow
        icon={Keyboard}
        title={t("SHORTCUTS")}
        summary={t("SHORTCUTS_SUMMARY")}
        onclick={() => (dialog = "shortcuts")}
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
        summary={notifier.granted ? t("NOTIFICATIONS_STATE", activeNotifications) : t("NOTIFICATIONS_DISABLED")}
        onclick={() => (dialog = "notifications")}
      />
      {#if androidBackground()}
        <PreferenceRow
          icon={BatteryCharging}
          title={t("BATTERY_OPTIMIZATION")}
          summary={t("BATTERY_OPTIMIZATION_SUMMARY")}
          onclick={() => androidBackground()?.requestIgnoreBatteryOptimization()}
        >
          {#snippet trailing()}
            <CompactSwitch
              checked={batteryIgnored}
              onCheckedChange={() => androidBackground()?.requestIgnoreBatteryOptimization()}
            />
          {/snippet}
        </PreferenceRow>
      {/if}
      {#if isDesktop}
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
      >
        {#snippet trailing()}
          <ChevronRight size={24} class="text-on-surface-variant" />
        {/snippet}
      </PreferenceRow>
    </SettingsGroup>

    <div bind:this={serverSection}>
      <ServerGroup
        {tick}
        flash={flashed === "cli"}
        onLoadingChange={(value) => {
          if (!value) refreshing = false;
        }}
        onChangelog={(version) => (cliChangelog = version)}
      />
    </div>

    {#if isDesktop}
      <LocalServerGroup serverReady={backend.configured} />
    {/if}

    <SettingsGroup>
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

    <div bind:this={aboutSection}>
      <AboutGroup flash={flashed === "about"} />
    </div>
  </div>
</Screen>

{#if dialog === "theme"}
  <SelectDialog
    title={t("THEME")}
    options={themeOptions}
    selected={theme.mode}
    onSelect={(value) => theme.setMode(value as ThemeMode)}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "language"}
  <SelectDialog
    title={t("LANGUAGE")}
    options={localeOptions}
    selected={i18n.locale}
    onSelect={(value) => i18n.set(value as Locale)}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "font"}
  {#snippet fontPreview(option: SelectOption)}
    <span class="flex h-7 w-9 items-center justify-center text-[22px]" style="font-family: {option.font}"
      >😃</span
    >
  {/snippet}
  <SelectDialog
    title={t("FONT")}
    options={fontOptions}
    selected={theme.fontStyle}
    onSelect={(value) => theme.setFontStyle(value as FontStyle)}
    onDismiss={() => (dialog = null)}
    optionTrailing={fontPreview}
  />
{:else if dialog === "accent"}
  <AccentDialog
    title={t("ACCENT")}
    selected={theme.dynamicColor ? DYNAMIC_ACCENT : theme.accentIndex}
    onSelect={(index) => {
      if (index === DYNAMIC_ACCENT) theme.setDynamicColor(true);
      else if (index !== null) {
        theme.setDynamicColor(false);
        theme.setAccent(index);
      }
    }}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "shortcuts"}
  <ShortcutsDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "environments"}
  <EnvironmentsDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "notifications"}
  <NotificationsDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "reset"}
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
      refreshTick++;
      return true;
    }}
    onDismiss={() => (dialog = null)}
  />
{/if}

{#if cliChangelog !== undefined}
  {@const version = cliChangelog}
  <ChangelogDialog
    load={() => claudeChangelog(version)}
    limitHeight={false}
    onDismiss={() => (cliChangelog = undefined)}
  />
{/if}
