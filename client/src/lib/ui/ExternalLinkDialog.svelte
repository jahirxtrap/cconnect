<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { openExternal } from "$lib/platform";
  import { serverBrowser } from "$lib/screens/browser/serverBrowser.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";

  interface Props {
    url: string;
    onDismiss: () => void;
  }

  const { url, onDismiss }: Props = $props();

  const web = $derived(/^https?:\/\//i.test(url));
</script>

<CompactDialog title={t("OPEN_EXTERNAL_LINK")} description={t("OPEN_EXTERNAL_LINK_MESSAGE", url)} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    {#if web && backend.configured}
      <Button
        onclick={() => {
          const target = url;
          onDismiss();
          serverBrowser.open(target);
        }}
        variant="outlined">{t("OPEN_ON_SERVER")}</Button
      >
    {/if}
    <Button
      onclick={() => {
        openExternal(url);
        onDismiss();
      }}>{t("OPEN")}</Button
    >
  {/snippet}
</CompactDialog>
