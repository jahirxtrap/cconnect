<script lang="ts">
  import { formatList } from "$lib/data/format";
  import { canUsePack, exportPack, packFileName, removePack, usePack } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import { t } from "$lib/i18n/index.svelte";
  import { saveFileToDownloads } from "$lib/services/sharedFiles";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import PackBanner from "./PackBanner.svelte";
  import PackContent from "./PackContent.svelte";
  import { packByline, packErrorText } from "./packText";

  interface Props {
    pack: Pack;
    onDismiss: () => void;
  }

  const { pack, onDismiss }: Props = $props();

  let deleting = $state(false);
  let failure = $state<string | null>(null);

  const save = async () => {
    failure = null;
    try {
      const blob = await exportPack(pack);
      if (blob) await saveFileToDownloads(packFileName(pack), blob);
    } catch (error) {
      failure = packErrorText(error);
    }
  };

  const remove = async () => {
    deleting = false;
    await removePack(pack.info.id);
    onDismiss();
  };
</script>

<CompactDialog title={pack.info.name} subtitle={packByline(pack)} {onDismiss}>
  {#snippet buttons()}
    {#if !pack.builtin}
      <Button onclick={() => (deleting = true)} variant="danger">{t("DELETE")}</Button>
    {/if}
    <Button onclick={() => void save()} variant="outlined">{t("EXPORT")}</Button>
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
    {#if canUsePack(pack)}
      <Button
        onclick={() => {
          usePack(pack);
          onDismiss();
        }}>{t("PACK_USE")}</Button
      >
    {/if}
  {/snippet}
  <div class="flex w-full flex-col gap-3">
    <PackBanner {pack} />
    {#if pack.info.description || pack.info.contributors.length}
      <div class="flex flex-col gap-1">
        {#if pack.info.description}
          <p class="text-body-md wrap-anywhere text-on-surface">{pack.info.description}</p>
        {/if}
        {#if pack.info.contributors.length}
          <p class="text-body-sm text-on-surface-variant">
            {t("PACK_CONTRIBUTORS", formatList(pack.info.contributors))}
          </p>
        {/if}
      </div>
    {/if}
    {#if failure}
      <ErrorText text={failure} />
    {/if}
    <PackContent {pack} />
  </div>
</CompactDialog>

{#if deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("PACK_DELETE_CONFIRM", pack.info.name)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => void remove()}
    onDismiss={() => (deleting = false)}
  />
{/if}
