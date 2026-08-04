<script lang="ts">
  import Coffee from "@lucide/svelte/icons/coffee";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import { APP_VERSION } from "$lib/data/build";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import {
    contributorProfile,
    KOFI_URL,
    latestRelease,
    ownerProfile,
    RELEASES_URL,
    type Profile,
    type Release,
  } from "$lib/services/githubApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import AppLogo from "$lib/ui/AppLogo.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";

  let release = $state<Release | null>(null);
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

  $effect(() => {
    void ownerProfile().then((value) => (owner = value));
    void contributorProfile().then((value) => (contributor = value));
  });
</script>

{#snippet profileRow(profile: Profile | null, label: string)}
  {#if profile}
    <Pressable onclick={() => open(profile.url)} class="flex w-full items-center gap-4 px-4 py-2.5">
      <img src={profile.avatarUrl} alt="" class="size-6 shrink-0 rounded-full" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-body-lg">{profile.name ?? profile.login}</p>
        <p class="truncate text-body-sm text-on-surface-variant">{label}</p>
      </div>
      <ExternalLink size={14} class="shrink-0 text-on-surface-variant" />
    </Pressable>
  {/if}
{/snippet}

<SettingsGroup label={t("ABOUT")}>
  <Pressable onclick={() => open(release?.url ?? RELEASES_URL)} class="flex w-full items-center gap-4 px-4 py-3">
    <AppLogo size={28} />
    <div class="min-w-0 flex-1">
      <p class="truncate text-body-lg">{t("APP_NAME")}</p>
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
    <ExternalLink size={14} class="shrink-0 text-on-surface-variant" />
  </Pressable>

  <div class="px-4 pb-2.5">
    <ActionButton
      class="w-full"
      text={outdated ? t("UPDATE_ACTION") : checking ? t("CHECKING_UPDATES") : t("CHECK_UPDATES")}
      enabled={!checking}
      onclick={() => (outdated && release ? open(release.url) : void check())}
    />
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
      <ExternalLink size={14} class="text-on-surface-variant" />
    {/snippet}
  </PreferenceRow>
</SettingsGroup>
