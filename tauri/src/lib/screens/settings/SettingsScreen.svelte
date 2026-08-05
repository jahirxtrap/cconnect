<script lang="ts">
  import Bell from "@lucide/svelte/icons/bell";
  import Clock from "@lucide/svelte/icons/clock";
  import History from "@lucide/svelte/icons/history";
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
  import { navigation } from "$lib/app/navigation.svelte";
  import { desktop } from "$lib/platform/desktop.svelte";
  import Screen from "$lib/app/Screen.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { ACCENTS } from "$lib/design/accents";
  import { theme, type FontStyle, type ThemeMode } from "$lib/design/theme.svelte";
  import { i18n, t, type Locale } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import { address, backend } from "$lib/services/backend.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog, { type SelectOption } from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChangelogDialog from "$lib/ui/ChangelogDialog.svelte";
  import { claudeChangelog } from "$lib/services/githubApi";
  import AboutGroup from "./AboutGroup.svelte";
  import AccentDialog from "./AccentDialog.svelte";
  import EnvironmentsDialog from "./EnvironmentsDialog.svelte";
  import LocalServerGroup from "./LocalServerGroup.svelte";
  import NotificationsDialog from "./NotificationsDialog.svelte";
  import ServerGroup from "./ServerGroup.svelte";

  type Dialog = "theme" | "language" | "font" | "accent" | "environments" | "notifications" | "reset";

  let cliChangelog = $state<string | null | undefined>(undefined);

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

  const FONT_FAMILIES: Record<FontStyle, string> = {
    system: "system-ui, sans-serif",
    flat: '"CConnect Flat", system-ui, sans-serif',
    color: '"CConnect Color", system-ui, sans-serif',
  };

  const FONT_OPTIONS = [
    { value: "system", label: t("FONT_SYSTEM"), font: FONT_FAMILIES.system },
    { value: "flat", label: t("FONT_FLAT"), font: FONT_FAMILIES.flat },
    { value: "color", label: t("FONT_COLOR"), font: FONT_FAMILIES.color },
  ];

  let dialog = $state<Dialog | null>(null);
  let refreshTick = $state(0);

  $effect(() => {
    const tick = refreshTick + desktop.refreshTick;
    if (tick > 0) void serverStatus.refresh();
  });
  let serverSection = $state<HTMLDivElement | null>(null);
  let aboutSection = $state<HTMLDivElement | null>(null);
  let flashed = $state<string | null>(null);

  const FLASH_MS = 1200;

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
  {#snippet actions()}
    <TooltipIconButton label={t("REFRESH")} onclick={() => refreshTick++}>
      <RotateCw size={20} />
    </TooltipIconButton>
  {/snippet}
  <div class="flex w-full flex-col px-4 pb-4">
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
        summary={theme.dynamicColor && theme.systemAccent ? t("ACCENT_DYNAMIC") : ACCENTS[theme.accentIndex]?.name}
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
      >
        {#snippet trailing()}
          <span class="flex size-10 items-center justify-center text-[22px]" data-font={theme.fontStyle}>😃</span>
        {/snippet}
      </PreferenceRow>
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

    <div bind:this={serverSection} class={flashed === "cli" ? "flash-highlight" : ""}>
      <ServerGroup onChangelog={(version) => (cliChangelog = version)} />
    </div>

    {#if isTauri}
      <LocalServerGroup serverReady={backend.configured} />
    {/if}

    <SettingsGroup>
      <PreferenceRow
        icon={History}
        title={t("RESET_SETTINGS")}
        summary={t("RESET_SETTINGS_SUMMARY")}
        onclick={() => (dialog = "reset")}
      />
    </SettingsGroup>

    <div bind:this={aboutSection} class={flashed === "about" ? "flash-highlight" : ""}>
      <AboutGroup />
    </div>
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
  {#snippet fontPreview(option: SelectOption)}
    <span class="flex size-10 items-center justify-center text-[22px]" style="font-family: {option.font}"
      >😃</span
    >
  {/snippet}
  <SelectDialog
    title={t("FONT")}
    options={FONT_OPTIONS}
    selected={theme.fontStyle}
    onSelect={(value) => theme.setFontStyle(value as FontStyle)}
    onDismiss={() => (dialog = null)}
    optionTrailing={fontPreview}
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

{#if cliChangelog !== undefined}
  {@const version = cliChangelog}
  <ChangelogDialog load={() => claudeChangelog(version)} onDismiss={() => (cliChangelog = undefined)} />
{/if}
