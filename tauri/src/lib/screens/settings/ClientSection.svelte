<script lang="ts">
  import Clock from "@lucide/svelte/icons/clock";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import Languages from "@lucide/svelte/icons/languages";
  import Moon from "@lucide/svelte/icons/moon";
  import Palette from "@lucide/svelte/icons/palette";
  import Sun from "@lucide/svelte/icons/sun";
  import SunMoon from "@lucide/svelte/icons/sun-moon";
  import Type from "@lucide/svelte/icons/type";
  import { settings } from "$lib/data/settings.svelte";
  import { ACCENTS, DYNAMIC_ACCENT } from "$lib/design/accents";
  import { theme, type FontStyle, type ThemeMode } from "$lib/design/theme.svelte";
  import { i18n, t, type Locale } from "$lib/i18n/index.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog, { type SelectOption } from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import AccentDialog from "./AccentDialog.svelte";
  import ShortcutsDialog from "./ShortcutsDialog.svelte";

  type Dialog = "theme" | "language" | "font" | "accent" | "shortcuts";

  let dialog = $state<Dialog | null>(null);

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

  const themeIcon = $derived(theme.mode === "light" ? Sun : theme.mode === "dark" ? Moon : SunMoon);

  const label = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
</script>

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
{/if}
