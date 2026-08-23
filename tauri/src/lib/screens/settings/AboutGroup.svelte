<script lang="ts">
  import Coffee from "@lucide/svelte/icons/coffee";

  import FileText from "@lucide/svelte/icons/file-text";
  import { exportSettings } from "$lib/data/backup";
  import { APP_VERSION } from "$lib/data/build";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import {
    ALT_MARK,
    ALT_WEB_URL,
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
  import { updater } from "$lib/services/updater.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import AppLogo from "$lib/ui/AppLogo.svelte";
  import BackupDialog from "./BackupDialog.svelte";
  import ChangelogDialog from "$lib/ui/ChangelogDialog.svelte";
  import ExternalIndicator from "$lib/ui/ExternalIndicator.svelte";
  import GithubIcon from "$lib/ui/GithubIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  let changelogOpen = $state(false);
  let switchOpen = $state(false);
  let owner = $state<Profile | null>(null);
  let contributor = $state<Profile | null>(null);
  let checking = $state(false);
  let switchChecking = $state(false);
  let switchDownloading = $state(false);

  const release = $derived(serverStatus.release);
  const updateAvailable = $derived(serverStatus.updateAvailable && !!release);
  const pendingIsSwitch = $derived(!!updater.pending && !updater.pending.path.includes(ALT_MARK));
  const switchBusy = $derived(switchChecking || switchDownloading);

  const open = (url: string) => openExternal(url);

  const check = async () => {
    checking = true;
    await serverStatus.checkRelease(true);
    checking = false;
  };

  const downloadingUpdate = $derived(updater.progress !== null && !switchDownloading);

  const updateLabel = $derived(
    downloadingUpdate
      ? t("CANCEL")
      : updater.pending && !pendingIsSwitch
        ? t("INSTALL")
        : updateAvailable
          ? t("UPDATE_ACTION")
          : checking
            ? t("CHECKING_UPDATES")
            : t("CHECK_UPDATES"),
  );

  const startUpdate = async (target: Release) => {
    const version = target.tag.replace(/^v/, "");
    if (!isTauri || !target.installerUrl) {
      open(target.url);
      return;
    }
    if (!(await updater.download(target.installerUrl, version)) && !updater.cancelled) open(target.url);
  };

  const startSwitch = async (url: string, target: Release) => {
    switchDownloading = true;
    const done = await updater.download(url, target.tag.replace(/^v/, ""));
    switchDownloading = false;
    if (!done && !updater.cancelled) open(target.url);
  };

  const openSwitch = async () => {
    if (isTauri) {
      switchChecking = true;
      await serverStatus.checkRelease(true);
      switchChecking = false;
    }
    switchOpen = true;
  };

  $effect(() => {
    void ownerProfile().then((value) => (owner = value));
    void contributorProfile().then((value) => (contributor = value));
  });
</script>

{#snippet profileRow(profile: Profile | null, label: string)}
  {#if profile}
    <Pressable onclick={() => open(profile.url)} class="flex w-full items-center gap-3 px-4 py-3">
      <img src={profile.avatarUrl} alt="" class="size-7 shrink-0 rounded-full" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-body-md">{profile.name ?? profile.login}</p>
        <p class="truncate text-body-sm text-on-surface-variant">{label}</p>
      </div>
      <ExternalIndicator />
    </Pressable>
  {/if}
{/snippet}

<SettingsGroup label={t("ABOUT")}>
  <Pressable onclick={() => open(release?.url ?? RELEASES_URL)} class="flex w-full items-center gap-3 px-4 py-3">
      <AppLogo size={28} />
      <div class="min-w-0 flex-1">
      <p class="truncate text-body-md">{t("APP_NAME")} (Tauri)</p>
      <p class="truncate text-body-sm text-on-surface-variant">{t("VERSION_LABEL", APP_VERSION)}</p>
      {#if serverStatus.appOutdated}
        <p class="text-body-sm text-red">{t("COMPAT_APP_OUTDATED")}</p>
      {/if}
      {#if serverStatus.serverOutdated}
        <p class="text-body-sm text-red">{t("COMPAT_SERVER_OUTDATED")}</p>
      {/if}
        {#if updateAvailable && release}
          <p class="text-body-sm text-accent">{t("UPDATE_AVAILABLE", release.tag)}</p>
        {:else if serverStatus.releaseChecked && !serverStatus.appOutdated && !serverStatus.serverOutdated}
          <p class="text-body-sm text-on-surface-variant">{t("UP_TO_DATE")}</p>
        {/if}
      </div>
      <div class="shrink-0">
        <TooltipIconButton label={t("CHANGELOG")} onclick={() => (changelogOpen = true)}>
          <FileText size={18} />
        </TooltipIconButton>
      </div>
  </Pressable>

  {#if updater.progress !== null}
    <div class="px-4 py-3">
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
        <div class="h-full bg-accent transition-[width]" style="width: {Math.round(updater.progress * 100)}%"></div>
      </div>
    </div>
  {/if}

  <div class="px-4 py-3">
    <div class="flex gap-2">
      <ActionButton
        class="min-w-0 flex-1"
        text={updateLabel}
        enabled={!checking && !switchBusy}
        onclick={() => {
          if (downloadingUpdate) updater.cancel();
          else if (updater.pending && !pendingIsSwitch) void updater.install();
          else if (updateAvailable && release) void startUpdate(release);
          else void check();
        }}
      />
      {#if pendingIsSwitch}
        <ActionButton class="min-w-0 flex-1" text={t("INSTALL")} onclick={() => void updater.install()} />
      {:else}
        <ActionButton
          class="min-w-0 flex-1"
          text={switchDownloading ? t("CANCEL") : switchChecking ? t("CHECKING_UPDATES") : t("SWITCH_BUILD")}
          enabled={!switchChecking}
          onclick={() => (switchDownloading ? updater.cancel() : void openSwitch())}
        />
      {/if}
    </div>
  </div>

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
</SettingsGroup>

{#if switchOpen}
  <BackupDialog
    mode="switch"
    payload={exportSettings()}
    canSwitch={!isTauri || !!release?.altInstallerUrl}
    onSwitch={() => {
      switchOpen = false;
      if (!isTauri) open(ALT_WEB_URL);
      else if (release?.altInstallerUrl) void startSwitch(release.altInstallerUrl, release);
    }}
    onDismiss={() => (switchOpen = false)}
  />
{/if}

{#if changelogOpen}
  <ChangelogDialog load={() => releaseNotes(APP_VERSION)} onDismiss={() => (changelogOpen = false)} />
{/if}
