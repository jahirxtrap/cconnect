<script lang="ts">
  import Cpu from "@lucide/svelte/icons/cpu";
  import Folder from "@lucide/svelte/icons/folder";
  import Globe from "@lucide/svelte/icons/globe";
  import Palette from "@lucide/svelte/icons/palette";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Server from "@lucide/svelte/icons/server";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { ACCENTS } from "$lib/design/accents";
  import { theme, type ThemeMode } from "$lib/design/theme.svelte";
  import { i18n, t, type Locale } from "$lib/i18n/index.svelte";
  import { isTauri, platformName } from "$lib/platform";
  import {
    ActionButton,
    Button,
    CompactSwitch,
    ConfirmDialog,
    EmptyState,
    ListRow,
    MetricBar,
    PreferenceRow,
    RenameDialog,
    SelectDialog,
    SettingsGroup,
    type SelectOption,
  } from "$lib/ui";

  theme.start();

  const THEME_OPTIONS: SelectOption[] = [
    { value: "system", label: t("THEME_SYSTEM") },
    { value: "light", label: t("THEME_LIGHT") },
    { value: "dark", label: t("THEME_DARK") },
  ];

  const LOCALE_OPTIONS: SelectOption[] = [
    { value: "system", label: t("THEME_SYSTEM") },
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
  ];

  let themeDialog = $state(false);
  let localeDialog = $state(false);
  let renameDialog = $state(false);
  let confirmDialog = $state(false);
  let notifications = $state(true);
  let name = $state(t("APP_NAME"));
</script>

<main class="mx-auto flex h-full max-w-3xl flex-col gap-2 overflow-y-auto p-4">
  <header class="flex items-baseline gap-3">
    <h1 class="text-headline">{name}</h1>
    <span class="text-body-sm text-on-surface-variant">
      {platformName()}{isTauri ? " · tauri" : ""}
    </span>
  </header>

  <SettingsGroup label={t("THEME")}>
    <PreferenceRow
      icon={Palette}
      title={t("THEME")}
      summary={THEME_OPTIONS.find((option) => option.value === theme.mode)?.label}
      onclick={() => (themeDialog = true)}
    />
    <PreferenceRow
      icon={Globe}
      title={t("LANGUAGE")}
      summary={LOCALE_OPTIONS.find((option) => option.value === i18n.locale)?.label}
      onclick={() => (localeDialog = true)}
    />
    <PreferenceRow
      icon={Server}
      title={t("NOTIFICATIONS")}
      summary={t("HOST")}
      onclick={() => (notifications = !notifications)}
    >
      {#snippet trailing()}
        <CompactSwitch checked={notifications} onCheckedChange={(value) => (notifications = value)} />
      {/snippet}
    </PreferenceRow>
  </SettingsGroup>

  <div class="flex flex-wrap gap-2 px-4 py-2">
    {#each ACCENTS as accent, index (accent.name)}
      <button
        class="size-6 cursor-pointer rounded-full ring-offset-2 ring-offset-background"
        class:ring-2={theme.accentIndex === index}
        style:background={accent.value}
        style:--tw-ring-color={accent.value}
        aria-label={accent.name}
        onclick={() => theme.setAccent(index)}
      ></button>
    {/each}
  </div>

  <SettingsGroup label={t("MONITOR")}>
    <div class="px-4 py-3">
      <MetricBar title={t("MONITOR")} subtitle={platformName()} percent={42.5} />
    </div>
    <ListRow icon={Cpu} title={t("MEMORY")} subtitle="8.2 GB / 32 GB" />
    <ListRow
      icon={Folder}
      title={t("PROJECT")}
      subtitle="~/DEV/cconnect"
      onclick={() => (renameDialog = true)}
      onlongclick={() => (confirmDialog = true)}
    />
    <EmptyState text={t("NO_HOSTS")} />
  </SettingsGroup>

  <div class="flex flex-wrap gap-2 px-4 py-2">
    <ActionButton text={t("RENAME")} icon={Pencil} onclick={() => (renameDialog = true)} />
    <ActionButton text={t("DELETE")} icon={Trash2} onclick={() => (confirmDialog = true)} />
    <Button onclick={() => theme.setMode("system")} variant="filled">{t("SAVE")}</Button>
  </div>
</main>

{#if themeDialog}
  <SelectDialog
    title={t("THEME")}
    options={THEME_OPTIONS}
    selected={theme.mode}
    onSelect={(value) => theme.setMode(value as ThemeMode)}
    onDismiss={() => (themeDialog = false)}
  />
{/if}

{#if localeDialog}
  <SelectDialog
    title={t("LANGUAGE")}
    options={LOCALE_OPTIONS}
    selected={i18n.locale}
    onSelect={(value) => i18n.set(value as Locale)}
    onDismiss={() => (localeDialog = false)}
  />
{/if}

{#if renameDialog}
  <RenameDialog
    initial={name}
    onConfirm={(value) => {
      name = value;
      renameDialog = false;
    }}
    onDismiss={() => (renameDialog = false)}
  />
{/if}

{#if confirmDialog}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("CONFIRM")}
    confirmLabel={t("DELETE")}
    onConfirm={() => (confirmDialog = false)}
    onDismiss={() => (confirmDialog = false)}
  />
{/if}
