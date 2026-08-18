<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend, address } from "$lib/services/backend.svelte";
  import AppLogo from "$lib/ui/AppLogo.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";

  interface Props {
    selected: string | null;
    onSelect: (id: string) => void;
    class?: string;
  }

  const { selected, onSelect, class: className = "" }: Props = $props();

  let open = $state(false);

  const profile = $derived(backend.find(selected));

  const options = $derived(
    backend.environments.map((profile) => ({
      value: profile.id,
      label: profile.name,
      subtitle: address(profile),
    })),
  );
</script>

{#if profile && settings.environmentLocked}
  <div class="flex items-center rounded-md px-2 py-1 {className}">
    <AppLogo />
    <div class="ml-2 min-w-0 flex-1">
      <p class="truncate text-title-md leading-[18px]">{profile.name}</p>
      <p class="truncate text-label-sm leading-[12px] text-on-surface-variant">{address(profile)}</p>
    </div>
  </div>
{:else if profile}
  <Pressable onclick={() => (open = true)} class="flex items-center rounded-md px-2 py-1 {className}">
    <AppLogo />
    <div class="ml-2 min-w-0 flex-1">
      <p class="truncate text-title-md leading-[18px]">{profile.name}</p>
      <p class="truncate text-label-sm leading-[12px] text-on-surface-variant">{address(profile)}</p>
    </div>
    <ChevronDown size={24} class="shrink-0 text-on-surface-variant" />
  </Pressable>
{:else}
  <div class="flex items-center px-2 {className}">
    <AppLogo />
    <p class="ml-2 truncate text-title-lg">{t("APP_NAME")}</p>
  </div>
{/if}

{#if open}
  <SelectDialog
    title={t("ENVIRONMENT")}
    {options}
    selected={profile?.id ?? ""}
    {onSelect}
    onDismiss={() => (open = false)}
  />
{/if}
