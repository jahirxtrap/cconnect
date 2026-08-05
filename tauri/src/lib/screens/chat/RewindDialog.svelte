<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import type { RewindPoint, RewindPreview } from "$lib/services/sessionsApi";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";

  interface Props {
    points: RewindPoint[];
    loading: boolean;
    target: RewindPoint | null;
    preview: RewindPreview | null;
    busy: boolean;
    onSelect: (point: RewindPoint) => void;
    onRewind: (mode: "both" | "conversation") => void;
    onDismiss: () => void;
  }

  const { points, loading, target, preview, busy, onSelect, onRewind, onDismiss }: Props = $props();
</script>

<CompactDialog title={t("REWIND")} {onDismiss} padded={false}>
  {#snippet buttons()}
    <Button onclick={onDismiss}>{t("CANCEL")}</Button>
    {#if target}
      <Button onclick={() => onRewind("conversation")} enabled={!busy && preview?.canRewind === true}>
        {t("REWIND_CONVERSATION")}
      </Button>
      <Button onclick={() => onRewind("both")} enabled={!busy && preview?.canRewind === true}>
        {t("REWIND_BOTH")}
      </Button>
    {/if}
  {/snippet}

  {#if loading}
    <CenteredProgress class="py-6" />
  {:else if !points.length}
    <EmptyState text={t("REWIND_EMPTY")} />
  {:else}
    {#each points as point (point.id)}
      <DialogSelectItem
        label={point.text || point.id}
        selected={target?.id === point.id}
        onclick={() => onSelect(point)}
      />
    {/each}
    {#if target}
      <p class="flex items-center gap-1 px-5 pt-2 text-body-sm text-on-surface-variant">
        {#if preview === null}
          <LoadingIndicator size={13} />
          {t("LOADING")}
        {:else if preview.canRewind}
          {t("REWIND_FILES_COUNT", preview.filesChanged.length)} · +{preview.insertions} −{preview.deletions}
        {:else}
          {preview.error ?? t("REWIND_NO_CHECKPOINT")}
        {/if}
      </p>
    {/if}
  {/if}
</CompactDialog>
