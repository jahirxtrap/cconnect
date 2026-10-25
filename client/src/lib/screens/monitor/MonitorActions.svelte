<script lang="ts">
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import EnvironmentAction from "$lib/screens/chat/EnvironmentAction.svelte";
  import { systemApi } from "$lib/services/systemApi";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  let restartOpen = $state(false);
</script>

<TooltipIconButton
  label={t("RESTART_SERVER")}
  enabled={serverStatus.online}
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
