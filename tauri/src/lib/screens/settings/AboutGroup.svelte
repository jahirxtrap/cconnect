<script lang="ts">
  import Coffee from "@lucide/svelte/icons/coffee";

  import FileText from "@lucide/svelte/icons/file-text";
  import { APP_VERSION } from "$lib/data/build";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import {
    contributorProfile,
    KOFI_URL,
    latestRelease,
    ownerProfile,
    releaseNotes,
    RELEASES_URL,
    REPO_URL,
    type Profile,
    type Release,
  } from "$lib/services/githubApi";
  import { isTauri } from "$lib/platform";
  import { updater } from "$lib/services/updater.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import AppLogo from "$lib/ui/AppLogo.svelte";
  import ChangelogDialog from "$lib/ui/ChangelogDialog.svelte";
  import ExternalIndicator from "$lib/ui/ExternalIndicator.svelte";
  import GithubIcon from "$lib/ui/GithubIcon.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  let release = $state<Release | null>(null);
  let changelogOpen = $state(false);
  let owner = $state<Profile | null>(null);
  let contributor = $state<Profile | null>(null);
  let checking = $state(false);

  const outdated = $derived(release !== null && release.tag.replace(/^v/, "") !== APP_VERSION);

  const open = (url: string) => window.open(url, "_blank", "noopener");

  const check = async () => {
    checking = true;
    release = await latestRelease();
    checking = false;
  };

  const updateLabel = $derived(
    updater.pending
      ? t("INSTALL_UPDATE")
      : outdated
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
    if (!(await updater.download(target.installerUrl, version))) open(target.url);
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
        <p class="truncate text-body-md font-medium">{profile.name ?? profile.login}</p>
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
      <p class="truncate text-body-md font-medium">{t("APP_NAME")}</p>
      <p class="truncate text-body-sm text-on-surface-variant">{t("VERSION_LABEL", APP_VERSION)}</p>
      {#if serverStatus.appOutdated}
        <p class="text-body-sm text-red">{t("COMPAT_APP_OUTDATED")}</p>
      {/if}
      {#if serverStatus.serverOutdated}
        <p class="text-body-sm text-red">{t("COMPAT_SERVER_OUTDATED")}</p>
      {/if}
        {#if outdated && release}
          <p class="text-body-sm text-accent">{t("UPDATE_AVAILABLE", release.tag)}</p>
        {:else if release}
          <p class="text-body-sm text-on-surface-variant">{t("UP_TO_DATE")}</p>
        {/if}
      </div>
      <div class="shrink-0">
        <TooltipIconButton label={t("CHANGELOG")} onclick={() => (changelogOpen = true)}>
          <FileText size={18} />
        </TooltipIconButton>
      </div>
  </Pressable>

  <div class="px-4 py-3">
    {#if updater.progress !== null}
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
        <div class="h-full bg-accent transition-[width]" style="width: {Math.round(updater.progress * 100)}%"></div>
      </div>
    {:else}
      <ActionButton
        class="w-full"
        text={updateLabel}
        enabled={!checking}
        onclick={() => {
          if (updater.pending) void updater.install();
          else if (outdated && release) void startUpdate(release);
          else void check();
        }}
      />
    {/if}
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

{#if changelogOpen}
  <ChangelogDialog load={() => releaseNotes(APP_VERSION)} onDismiss={() => (changelogOpen = false)} />
{/if}
