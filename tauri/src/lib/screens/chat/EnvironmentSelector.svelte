<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { t } from "$lib/i18n/index.svelte";
  import { backend, address } from "$lib/services/backend.svelte";
  import AppLogo from "$lib/ui/AppLogo.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";

  interface Props {
    class?: string;
  }

  const { class: className = "" }: Props = $props();

  let open = $state(false);

  const options = $derived(
    backend.environments.map((profile) => ({
      value: profile.id,
      label: profile.name,
      subtitle: address(profile),
    })),
  );
</script>

{#if backend.active}
  <Pressable onclick={() => (open = true)} class="flex items-center rounded-xs px-2 py-1 {className}">
    <AppLogo />
    <div class="ml-2 min-w-0 flex-1">
      <p class="truncate text-title-md">{backend.active.name}</p>
      <p class="truncate text-label-md text-on-surface-variant">{address(backend.active)}</p>
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
    selected={backend.active?.id ?? ""}
    onSelect={(id) => backend.select(id)}
    onDismiss={() => (open = false)}
  />
{/if}
