<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import type { CliInfo } from "$lib/services/cliApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import CliControls from "$lib/screens/claude/CliControls.svelte";

  interface Props {
    info: CliInfo;
    onChanged: (info: CliInfo) => void;
    onDismiss: () => void;
  }

  const { info, onChanged, onDismiss }: Props = $props();
</script>

<CompactDialog title={t("CLI")} padded={false} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  <div class="px-1">
    <CliControls {info} enabled onChanged={onChanged} />
  </div>
</CompactDialog>
