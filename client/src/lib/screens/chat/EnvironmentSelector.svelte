<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Server from "@lucide/svelte/icons/server";
  import { joined } from "$lib/data/format";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { address, backend, environmentOptions } from "$lib/services/backend.svelte";
  import AppLogo from "$lib/ui/AppLogo.svelte";
  import { SUBTITLE_CLASS, TITLE_CLASS } from "$lib/ui/AppTopBar.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    selected: string | null;
    onSelect: (id: string) => void;
    compact?: boolean;
    class?: string;
  }

  const { selected, onSelect, compact = false, class: className = "" }: Props = $props();

  const LOGO_SIZE = 28;

  let open = $state(false);

  const profile = $derived(backend.find(selected));
  const locked = $derived(!profile || settings.environmentLocked);

  const options = $derived(environmentOptions());
</script>

{#if compact}
  {#if !locked && backend.environments.length > 1}
    <TooltipIconButton label={joined(t("ENVIRONMENT"), profile?.name)} onclick={() => (open = true)}>
      <Server />
    </TooltipIconButton>
  {/if}
{:else}
  <Pressable
    onclick={locked ? undefined : () => (open = true)}
    class="flex h-10 min-w-0 items-center gap-2.5 rounded-md px-2.5 {className}"
  >
    <AppLogo size={LOGO_SIZE} />
    <span class="flex min-w-0 flex-1 flex-col text-left">
      <span class={TITLE_CLASS}>{profile?.name ?? t("APP_NAME")}</span>
      {#if profile}
        <span class={SUBTITLE_CLASS}>{address(profile)}</span>
      {/if}
    </span>
    {#if !locked}
      <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
    {/if}
  </Pressable>
{/if}

{#if open}
  <SelectDialog
    title={t("ENVIRONMENT")}
    empty={t("NO_ENVIRONMENTS")}
    {options}
    selected={profile?.id ?? ""}
    {onSelect}
    onDismiss={() => (open = false)}
  />
{/if}
