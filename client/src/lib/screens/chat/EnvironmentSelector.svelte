<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Server from "@lucide/svelte/icons/server";
  import Settings from "@lucide/svelte/icons/settings";
  import { environmentLinks } from "$lib/data/environmentLinks.svelte";
  import { joined } from "$lib/data/format";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import EnvironmentsDialog from "$lib/screens/settings/EnvironmentsDialog.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import AppLogo from "$lib/ui/AppLogo.svelte";
  import { SUBTITLE_CLASS, TITLE_CLASS } from "$lib/ui/AppTopBar.svelte";
  import { LINK_LOOKS } from "$lib/ui/linkStatus";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import { MENU_ICON_SIZE } from "$lib/ui/menuSurface";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
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
  let managing = $state(false);

  const profile = $derived(backend.find(selected));
  const locked = $derived(!profile || settings.environmentLocked);

  const toggle = (next: boolean) => {
    open = next;
    if (next) environmentLinks.check(backend.environments);
  };

  const pick = (id: string) => {
    open = false;
    onSelect(id);
  };
</script>

{#snippet head()}
  <AppLogo size={LOGO_SIZE} />
  <span class="flex min-w-0 flex-1 flex-col text-left">
    <span class={TITLE_CLASS}>{profile?.name ?? t("APP_NAME")}</span>
    {#if profile}
      <span class={SUBTITLE_CLASS}>{address(profile)}</span>
    {/if}
  </span>
{/snippet}

{#snippet fullTrigger()}
  {@render head()}
  <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
{/snippet}

{#snippet compactTrigger(props: Record<string, unknown>)}
  <TooltipIconButton label={joined(t("ENVIRONMENT"), profile?.name)} {...props}>
    <Server />
  </TooltipIconButton>
{/snippet}

{#if locked}
  {#if !compact}
    <div class="flex h-10 min-w-0 items-center gap-2.5 rounded-md px-2.5 {className}">
      {@render head()}
    </div>
  {/if}
{:else if !compact || backend.environments.length > 1}
  <PopupMenu
    {open}
    onOpenChange={toggle}
    label={t("ENVIRONMENT")}
    triggerClass="flex h-10 min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2.5 transition-colors hover:bg-hover {className}"
    trigger={compact ? undefined : fullTrigger}
    triggerChild={compact ? compactTrigger : undefined}
  >
    {#each backend.environments as environment (environment.id)}
      {@const link = environmentLinks.linkOf(environment)}
      {@const look = link === "connected" ? null : LINK_LOOKS[link]}
      <MenuItem
        text={environment.name}
        description={address(environment)}
        selected={environment.id === profile?.id}
        onclick={() => pick(environment.id)}
      >
        {#snippet leading()}
          <StatusDot box={MENU_ICON_SIZE} class={look?.dot ?? "bg-green"} loading={look?.spinner ?? false} />
        {/snippet}
      </MenuItem>
    {/each}
    {#snippet footer()}
      <MenuItem icon={Settings} text={t("MANAGE_ENVIRONMENTS")} onclick={() => (managing = true)} />
    {/snippet}
  </PopupMenu>
{/if}

{#if managing}
  <EnvironmentsDialog onDismiss={() => (managing = false)} />
{/if}
