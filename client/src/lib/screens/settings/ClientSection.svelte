<script lang="ts">
  import Clock from "@lucide/svelte/icons/clock";
  import Expand from "@lucide/svelte/icons/expand";
  import Globe from "@lucide/svelte/icons/globe";
  import ImageIcon from "@lucide/svelte/icons/image";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import Languages from "@lucide/svelte/icons/languages";
  import ListOrdered from "@lucide/svelte/icons/list-ordered";
  import Moon from "@lucide/svelte/icons/moon";
  import Package from "@lucide/svelte/icons/package";
  import Palette from "@lucide/svelte/icons/palette";
  import Puzzle from "@lucide/svelte/icons/puzzle";
  import Sun from "@lucide/svelte/icons/sun";
  import SunMoon from "@lucide/svelte/icons/sun-moon";
  import SwatchBook from "@lucide/svelte/icons/swatch-book";
  import Type from "@lucide/svelte/icons/type";
  import { settings } from "$lib/data/settings.svelte";
  import { theme, type ThemeMode } from "$lib/design/theme.svelte";
  import { i18n, t, type Locale } from "$lib/i18n/index.svelte";
  import { isDesktop } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { deviceBrowsing } from "$lib/screens/browser/deviceEngine";
  import PacksDialog from "$lib/screens/packs/PacksDialog.svelte";
  import { useServerPacks } from "$lib/services/serverPacks.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import DiscordIcon from "$lib/ui/DiscordIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import AccentDialog from "./AccentDialog.svelte";
  import BrowserDialog from "./BrowserDialog.svelte";
  import ChatBackgroundDialog from "./ChatBackgroundDialog.svelte";
  import DiscordDialog from "./DiscordDialog.svelte";
  import FontDialog from "./FontDialog.svelte";
  import { entryHint, entryFor, type SettingsDialog } from "./settingsIndex";
  import { useSettingsDialog } from "./useSettingsDialog.svelte";
  import { appearanceOptions, localeOptions } from "./settingsValues";
  import ShortcutsDialog from "./ShortcutsDialog.svelte";
  import ThemeDialog from "./ThemeDialog.svelte";

  let dialog = $state<SettingsDialog | null>(null);

  const appearances = $derived(appearanceOptions());
  const locales = $derived(localeOptions());
  const appearanceIcon = $derived(theme.mode === "light" ? Sun : theme.mode === "dark" ? Moon : SunMoon);

  const rowSummary = (id: string) => {
    const entry = entryFor(id);
    return entry ? entryHint(entry) : "";
  };

  useSettingsDialog("client", (target) => (dialog = target));
  useServerPacks();
</script>

<SettingsGroup label={t("SETTINGS_CLIENT")}>
  <PreferenceRow
    icon={appearanceIcon}
    title={t("APPEARANCE")}
    summary={rowSummary("appearance")}
    onclick={() => (dialog = "appearance")}
  />
  <PreferenceRow
    icon={SwatchBook}
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
    icon={ImageIcon}
    title={t("CHAT_BACKGROUND")}
    summary={rowSummary("chat_background")}
    onclick={() => (dialog = "chat_background")}
  />
  <PreferenceRow
    icon={Type}
    title={t("FONT")}
    summary={rowSummary("font")}
    onclick={() => (dialog = "font")}
  >
    {#snippet trailing()}
      <span class="flex h-7 w-9 items-center justify-center text-title-lg">😃</span>
    {/snippet}
  </PreferenceRow>
  <PreferenceRow
    icon={Package}
    title={t("PACKS")}
    summary={rowSummary("packs")}
    onclick={() => (dialog = "packs")}
  />
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
  <PreferenceRow
    icon={ListOrdered}
    title={t("LINE_NUMBERS")}
    summary={rowSummary("line_numbers")}
    onclick={() => (settings.codeLineNumbers = !settings.codeLineNumbers)}
  >
    {#snippet trailing()}
      <CompactSwitch
        checked={settings.codeLineNumbers}
        onCheckedChange={(value) => (settings.codeLineNumbers = value)}
      />
    {/snippet}
  </PreferenceRow>
  <PreferenceRow
    icon={Puzzle}
    title={t("MOD_BAND_HANDLE")}
    summary={rowSummary("mod_band_handle")}
    onclick={() => (settings.modBandHandle = !settings.modBandHandle)}
  >
    {#snippet trailing()}
      <CompactSwitch
        checked={settings.modBandHandle}
        onCheckedChange={(value) => (settings.modBandHandle = value)}
      />
    {/snippet}
  </PreferenceRow>
  {#if !layout.mobile}
    <PreferenceRow
      icon={Expand}
      title={t("CHAT_FILES")}
      summary={rowSummary("chat_files")}
      onclick={() => (settings.chatViewFull = !settings.chatViewFull)}
    >
      {#snippet trailing()}
        <CompactSwitch
          checked={settings.chatViewFull}
          onCheckedChange={(value) => (settings.chatViewFull = value)}
        />
      {/snippet}
    </PreferenceRow>
  {/if}
  {#if deviceBrowsing}
    <PreferenceRow
      icon={Globe}
      title={t("BROWSER")}
      summary={rowSummary("browser")}
      onclick={() => (dialog = "browser")}
    />
  {/if}
  {#if isDesktop}
    <PreferenceRow
      icon={DiscordIcon}
      title={t("DISCORD_PRESENCE")}
      summary={rowSummary("discord")}
      onclick={() => (dialog = "discord")}
    />
  {/if}
</SettingsGroup>

{#if dialog === "appearance"}
  <SelectDialog
    title={t("APPEARANCE")}
    options={appearances}
    selected={theme.mode}
    onSelect={(value) => theme.setMode(value as ThemeMode)}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "theme"}
  <ThemeDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "language"}
  <SelectDialog
    title={t("LANGUAGE")}
    options={locales}
    selected={i18n.locale}
    onSelect={(value) => i18n.set(value as Locale)}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "font"}
  <FontDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "packs"}
  <PacksDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "accent"}
  <AccentDialog
    title={t("ACCENT")}
    selected={theme.accentId}
    closeOnPick
    onSelect={(choice) => {
      if (choice !== null) theme.setAccent(choice);
    }}
    onDismiss={() => (dialog = null)}
  />
{:else if dialog === "chat_background"}
  <ChatBackgroundDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "shortcuts"}
  <ShortcutsDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "discord"}
  <DiscordDialog onDismiss={() => (dialog = null)} />
{:else if dialog === "browser"}
  <BrowserDialog onDismiss={() => (dialog = null)} />
{/if}
