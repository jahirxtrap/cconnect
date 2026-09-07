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
  import { DYNAMIC_ACCENT } from "$lib/design/accents";
  import { theme, type FontStyle, type ThemeMode } from "$lib/design/theme.svelte";
  import { i18n, t, type Locale } from "$lib/i18n/index.svelte";
  import { isDesktop } from "$lib/platform";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import DiscordIcon from "$lib/ui/DiscordIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog, { type SelectOption } from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import AccentDialog from "./AccentDialog.svelte";
  import DiscordDialog from "./DiscordDialog.svelte";
  import { entryHint, entryFor, type SettingsDialog } from "./settingsIndex";
  import { useSettingsDialog } from "./useSettingsDialog.svelte";
  import { fontOptions, localeOptions, themeOptions } from "./settingsValues";
  import ShortcutsDialog from "./ShortcutsDialog.svelte";

  let dialog = $state<SettingsDialog | null>(null);

  const themes = $derived(themeOptions());
  const locales = $derived(localeOptions());
  const fonts = $derived(fontOptions());

  const themeIcon = $derived(theme.mode === "light" ? Sun : theme.mode === "dark" ? Moon : SunMoon);

  const rowSummary = (id: string) => {
    const entry = entryFor(id);
    return entry ? entryHint(entry) : "";
  };

  useSettingsDialog("client", (target) => (dialog = target));
</script>

<SettingsGroup label={t("SETTINGS_CLIENT")}>
  <PreferenceRow
    icon={themeIcon}
    title={t("THEME")}
    summary={rowSummary("theme")}
    onclick={() => (dialog = "theme")}
  />
  <PreferenceRow
    icon={Languages}
    title={t("LANGUAGE")}
    summary={rowSummary("language")}
    onclick={() => (dialog = "language")}
  />
  <PreferenceRow
    icon={Palette}
    title={t("ACCENT")}
    summary={rowSummary("accent")}
    onclick={() => (dialog = "accent")}
  >
    {#snippet trailing()}
      <span class="flex h-7 w-9 items-center justify-center"><span class="size-5 rounded-full" style="background: {theme.appAccent}"></span></span>
    {/snippet}
  </PreferenceRow>
  <PreferenceRow
    icon={Type}
    title={t("FONT")}
    summary={rowSummary("font")}
    onclick={() => (dialog = "font")}
  >
    {#snippet trailing()}
      <span class="flex h-7 w-9 items-center justify-center text-[22px]" data-font={theme.fontStyle}>😃</span>
    {/snippet}
  </PreferenceRow>
  <PreferenceRow
    icon={Keyboard}
    title={t("SHORTCUTS")}
    summary={rowSummary("shortcuts")}
    onclick={() => (dialog = "shortcuts")}
  />
  <PreferenceRow
    icon={Clock}
    title={t("SHOW_TIMESTAMPS")}
    summary={rowSummary("timestamps")}
    onclick={() => (settings.showTimestamps = !settings.showTimestamps)}
  >
    {#snippet trailing()}
      <CompactSwitch
        checked={settings.showTimestamps}
        onCheckedChange={(value) => (settings.showTimestamps = value)}
      />
    {/snippet}
  </PreferenceRow>
  {#if isDesktop}
    <PreferenceRow
      icon={DiscordIcon}
      title={t("DISCORD_PRESENCE")}
      summary={rowSummary("discord")}
      onclick={() => (dialog = "discord")}
    />
  {/if}
</SettingsGroup>

{#if dialog === "theme"}
  <SelectDialog
    title={t("THEME")}
    options={themes}
    selected={theme.mode}
    onSelect={(value) => theme.setMode(value as ThemeMode)}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "language"}
  <SelectDialog
    title={t("LANGUAGE")}
    options={locales}
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
    options={fonts}
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
{:else if dialog === "discord"}
  <DiscordDialog onDismiss={() => (dialog = null)} />
{/if}
