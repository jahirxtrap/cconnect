<script lang="ts">
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import { t } from "$lib/i18n/index.svelte";
  import EnvironmentAction from "$lib/screens/chat/EnvironmentAction.svelte";
  import { paneActionClass } from "$lib/screens/chat/paneChrome";
  import { systemApi } from "$lib/services/systemApi";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { monitor } from "./monitor.svelte";

  interface Props {
    compact?: boolean;
  }

  const { compact = false }: Props = $props();

  let restartOpen = $state(false);
</script>

<TooltipIconButton
  label={t("RESTART_SERVER")}
  class={paneActionClass(compact)}
  enabled={!monitor.failed && monitor.info !== null}
  onclick={() => (restartOpen = true)}
>
  <ServerCog />
</TooltipIconButton>
<EnvironmentAction {compact} />

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
