<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import type { RewindPoint, RewindPreview } from "$lib/services/sessionsApi";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";

  interface Props {
    points: RewindPoint[];
    loading: boolean;
    target: RewindPoint | null;
    preview: RewindPreview | null;
    busy: boolean;
    onSelect: (point: RewindPoint) => void;
    onRewind: (mode: "both" | "conversation") => void;
    onBack: () => void;
    onDismiss: () => void;
  }

  const { points, loading, target, preview, busy, onSelect, onRewind, onBack, onDismiss }: Props =
    $props();

  const codeAvailable = $derived(preview?.canRewind !== false);

  let both = $state(true);

  $effect(() => {
    if (preview !== null && !preview.canRewind) both = false;
  });

  const ordered = $derived([...points].reverse());
</script>

{#if target}
  <CompactDialog title={t("REWIND")} onDismiss={() => !busy && onBack()} padded={false}>
    {#snippet buttons()}
      <Button onclick={onBack} variant="outlined" enabled={!busy}>{t("CANCEL")}</Button>
      <Button onclick={() => onRewind(both ? "both" : "conversation")} enabled={!busy}>
        {t("ACCEPT")}
      </Button>
    {/snippet}

    <OutlinedPanel class="mx-5">
      <p class="selectable line-clamp-3 text-body-md">{target.text || target.id}</p>
      {#if both}
        <p class="mt-1 flex items-center gap-1 text-label-md text-on-surface-variant">
          {#if preview === null}
            <LoadingIndicator size={13} />
            {t("LOADING")}
          {:else if preview.canRewind}
            <span class="text-green">+{preview.insertions}</span>
            <span class="text-red">−{preview.deletions}</span>
            <span>• {t("REWIND_FILES_COUNT", preview.filesChanged.length)}</span>
          {:else}
            {preview.error ?? t("REWIND_NO_CHECKPOINT")}
          {/if}
        </p>
      {/if}
    </OutlinedPanel>

    <div class="h-2"></div>
    <DialogSelectItem
      label={t("REWIND_BOTH")}
      selected={both}
      enabled={!busy && codeAvailable}
      onclick={() => (both = true)}
    />
    <DialogSelectItem
      label={t("REWIND_CONVERSATION")}
      selected={!both}
      enabled={!busy}
      onclick={() => (both = false)}
    />
  </CompactDialog>
{:else}
  <CompactDialog title={t("REWIND")} {onDismiss} padded={false}>
    {#snippet buttons()}
      <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
    {/snippet}

    {#if loading}
      <CenteredProgress class="py-6" />
    {:else if !points.length}
      <EmptyState text={t("REWIND_EMPTY")} />
    {:else}
      <div class="flex flex-col gap-2 px-5 pb-2">
        {#each ordered as point (point.id)}
          <OutlinedPanel onclick={() => onSelect(point)} class="w-full text-left">
            <p class="selectable line-clamp-2 text-body-md">{point.text || point.id}</p>
          </OutlinedPanel>
        {/each}
      </div>
    {/if}
  </CompactDialog>
{/if}
