<script lang="ts">
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import { t } from "$lib/i18n/index.svelte";
  import EnvironmentAction from "$lib/screens/chat/EnvironmentAction.svelte";
  import { paneActionClass } from "$lib/screens/chat/paneChrome";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import { systemApi } from "$lib/services/systemApi";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { monitor } from "./monitor.svelte";

  const compact = inPane();

  let restartOpen = $state(false);
</script>

<TooltipIconButton
  label={t("RESTART_SERVER")}
  class={paneActionClass(compact)}
  enabled={!monitor.offline && monitor.info !== null}
  onclick={() => (restartOpen = true)}
>
  <ServerCog />
</TooltipIconButton>
<EnvironmentAction />

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
