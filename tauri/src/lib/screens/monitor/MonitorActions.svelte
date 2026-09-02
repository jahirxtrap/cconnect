<script lang="ts">
  import Server from "@lucide/svelte/icons/server";
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import { systemApi } from "$lib/services/systemApi";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { monitor } from "./monitor.svelte";

  interface Props {
    compact?: boolean;
    showEnvironment?: boolean;
  }

  const { compact = false, showEnvironment = true }: Props = $props();

  let envOpen = $state(false);
  let restartOpen = $state(false);

  const buttonClass = $derived(compact ? "size-8" : "");
  const iconSize = $derived(compact ? 18 : 20);
</script>

<TooltipIconButton
  label={t("RESTART_SERVER")}
  class={buttonClass}
  enabled={!monitor.failed && monitor.info !== null}
  onclick={() => (restartOpen = true)}
>
  <ServerCog size={iconSize} />
</TooltipIconButton>
{#if showEnvironment}
  <TooltipIconButton
    label={t("ENVIRONMENT")}
    class={buttonClass}
    enabled={!settings.environmentLocked}
    onclick={() => (envOpen = true)}
  >
    <Server size={iconSize} />
  </TooltipIconButton>
{/if}

{#if envOpen}
  <SelectDialog
    title={t("ENVIRONMENT")}
    options={backend.environments.map((profile) => ({
      value: profile.id,
      label: profile.name,
      subtitle: address(profile),
    }))}
    selected={tabs.state.environmentId ?? ""}
    onSelect={(id) => tabs.state.selectEnvironment(id)}
    onDismiss={() => (envOpen = false)}
  />
{/if}

{#if restartOpen}
  <ConfirmDialog
    title={t("RESTART_SERVER")}
    text={t("RESTART_SERVER_CONFIRM")}
    confirmLabel={t("CONFIRM")}
    onConfirm={() => {
      restartOpen = false;
      void systemApi.restart();
    }}
    onDismiss={() => (restartOpen = false)}
  />
{/if}
