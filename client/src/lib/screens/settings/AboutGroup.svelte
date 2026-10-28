<script lang="ts">
  import Coffee from "@lucide/svelte/icons/coffee";

  import FileText from "@lucide/svelte/icons/file-text";
  import MonitorDown from "@lucide/svelte/icons/monitor-down";
  import ScrollText from "@lucide/svelte/icons/scroll-text";
  import Share from "@lucide/svelte/icons/share";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import SquarePlus from "@lucide/svelte/icons/square-plus";
  import { APP_VERSION } from "$lib/data/build";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import {
    contributorProfile,
    KOFI_URL,
    ownerProfile,
    releaseNotes,
    RELEASES_URL,
    REPO_URL,
    type Profile,
    type Release,
  } from "$lib/services/githubApi";
  import { isTauri, openExternal } from "$lib/platform";
  import { webApp } from "$lib/platform/pwa.svelte";
  import { updater } from "$lib/services/updater.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import AppLogo from "$lib/ui/AppLogo.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ChangelogDialog from "$lib/ui/ChangelogDialog.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import ExternalIndicator from "$lib/ui/ExternalIndicator.svelte";
  import GithubIcon from "$lib/ui/GithubIcon.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import { PREFERENCE_ICON_SIZE, PREFERENCE_ROW_CLASS } from "$lib/ui/preferenceRow";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    flash?: boolean;
  }

  const { flash = false }: Props = $props();

  const PRIVACY_URL = "https://cconnect.dev/privacy";
  const TERMS_URL = "https://cconnect.dev/terms";

  let changelogOpen = $state(false);
  let homeScreenOpen = $state(false);
  let owner = $state<Profile | null>(null);
  let contributor = $state<Profile | null>(null);
  const release = $derived(serverStatus.release);
  const updateAvailable = $derived(serverStatus.updateAvailable && !!release);
  const checking = $derived(serverStatus.releaseChecking);

  const open = (url: string) => openExternal(url);

  const check = () => serverStatus.checkRelease(true);

  const downloadingUpdate = $derived(updater.progress !== null);

  const updateLabel = $derived(
    downloadingUpdate
      ? t("CANCEL")
      : updater.pending
        ? t("INSTALL")
        : updateAvailable
          ? t("UPDATE_ACTION")
          : checking
            ? t("CHECKING_UPDATES")
            : t("CHECK_UPDATES"),
  );

  const startUpdate = async (target: Release) => {
    if (!isTauri) {
      await updater.reload();
      return;
    }
    let ready = target;
    if (!ready.installerUrl) {
      await check();
      ready = serverStatus.release ?? ready;
    }
    if (!ready.installerUrl) {
      open(ready.url);
      return;
    }
    const version = ready.tag.replace(/^v/, "");
    if (!(await updater.download(ready.installerUrl, version)) && !updater.cancelled) open(ready.url);
  };

  $effect(() => {
    void ownerProfile().then((value) => (owner = value));
    void contributorProfile().then((value) => (contributor = value));
  });
</script>

{#snippet profileRow(profile: Profile | null, label: string)}
  {#if profile}
    <Pressable onclick={() => open(profile.url)} class={PREFERENCE_ROW_CLASS}>
      <img
        src={profile.avatarUrl}
        alt=""
        class="shrink-0 rounded-full"
        style="width: {PREFERENCE_ICON_SIZE}px; height: {PREFERENCE_ICON_SIZE}px"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-item-title">{profile.name ?? profile.login}</p>
        <p class="truncate text-body-sm text-on-surface-variant">{label}</p>
      </div>
      <ExternalIndicator />
    </Pressable>
  {/if}
{/snippet}

<SettingsGroup label={t("ABOUT")}>
  <Pressable
    onclick={() => open(release?.url ?? RELEASES_URL)}
    class="{PREFERENCE_ROW_CLASS} {flash ? 'flash-highlight' : ''}"
  >
      <AppLogo size={PREFERENCE_ICON_SIZE} />
      <div class="min-w-0 flex-1">
      <p class="truncate text-item-title">{t("APP_NAME")}</p>
      <p class="truncate text-body-sm text-on-surface-variant">{t("VERSION_LABEL", APP_VERSION)}</p>
      {#if serverStatus.appOutdated}
        <ErrorText text={t("COMPAT_APP_OUTDATED")} />
      {/if}
      {#if serverStatus.serverOutdated}
        <ErrorText text={t("COMPAT_SERVER_OUTDATED")} />
      {/if}
        {#if updateAvailable && release}
          <p class="text-body-sm text-accent">{t("UPDATE_AVAILABLE", release.tag)}</p>
        {:else if serverStatus.releaseFailed}
          <p class="text-body-sm text-on-surface-variant">{t("UPDATE_CHECK_FAILED")}</p>
        {:else if serverStatus.releaseChecked}
          <p class="text-body-sm text-on-surface-variant">{t("UP_TO_DATE")}</p>
        {/if}
      </div>
      <div class="shrink-0">
        <TooltipIconButton label={t("CHANGELOG")} onclick={() => (changelogOpen = true)}>
          <FileText size={18} />
        </TooltipIconButton>
      </div>
  </Pressable>

  <div class="flex flex-col gap-2.5 px-4 py-3">
    {#if updater.progress !== null}
      <LinearProgress value={updater.progress} />
    {/if}
    <ActionButton
      class="w-full"
      text={updateLabel}
      enabled={!checking}
      onclick={() => {
        if (downloadingUpdate) updater.cancel();
        else if (updater.pending) void updater.install();
        else if (updateAvailable && release) void startUpdate(release);
        else void check();
      }}
    />
  </div>

  {#if webApp.offered}
    <PreferenceRow
      icon={MonitorDown}
      title={t("INSTALL_APP")}
      summary={t("INSTALL_APP_SUMMARY")}
      onclick={() => {
        if (webApp.prompt) void webApp.install();
        else homeScreenOpen = true;
      }}
    />
  {/if}

  {@render profileRow(owner, t("CREATOR"))}
  {@render profileRow(contributor, t("CONTRIBUTOR"))}

  <PreferenceRow
    icon={Coffee}
    title={t("SUPPORT_CREATOR")}
    summary={KOFI_URL.replace("https://", "")}
    onclick={() => open(KOFI_URL)}
  >
    {#snippet trailing()}
      <ExternalIndicator />
    {/snippet}
  </PreferenceRow>

  <PreferenceRow
    icon={GithubIcon}
    title={t("REPOSITORY")}
    summary={REPO_URL.replace("https://", "")}
    onclick={() => open(REPO_URL)}
  >
    {#snippet trailing()}
      <ExternalIndicator />
    {/snippet}
  </PreferenceRow>

  <PreferenceRow
    icon={ShieldCheck}
    title={t("PRIVACY_POLICY")}
    summary={PRIVACY_URL.replace("https://", "")}
    onclick={() => open(PRIVACY_URL)}
  >
    {#snippet trailing()}
      <ExternalIndicator />
    {/snippet}
  </PreferenceRow>

  <PreferenceRow
    icon={ScrollText}
    title={t("TERMS_OF_SERVICE")}
    summary={TERMS_URL.replace("https://", "")}
    onclick={() => open(TERMS_URL)}
  >
    {#snippet trailing()}
      <ExternalIndicator />
    {/snippet}
  </PreferenceRow>
</SettingsGroup>

{#if homeScreenOpen}
  <CompactDialog title={t("ADD_TO_HOME")} onDismiss={() => (homeScreenOpen = false)}>
    {#snippet buttons()}
      <Button onclick={() => (homeScreenOpen = false)} variant="outlined">{t("CLOSE")}</Button>
    {/snippet}
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <Share size={18} class="shrink-0 text-on-surface-variant" />
        <p class="min-w-0 flex-1 text-body-md">{t("ADD_TO_HOME_SHARE")}</p>
      </div>
      <div class="flex items-center gap-3">
        <SquarePlus size={18} class="shrink-0 text-on-surface-variant" />
        <p class="min-w-0 flex-1 text-body-md">{t("ADD_TO_HOME_ADD")}</p>
      </div>
    </div>
  </CompactDialog>
{/if}

{#if changelogOpen}
  <ChangelogDialog load={() => releaseNotes(APP_VERSION)} onDismiss={() => (changelogOpen = false)} />
{/if}
