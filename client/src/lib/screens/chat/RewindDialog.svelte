<script lang="ts">
  import { readableText } from "$lib/data/pickedElements";
  import { t } from "$lib/i18n/index.svelte";
  import type { RewindPoint, RewindPreview } from "$lib/services/sessionsApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";

  interface Props {
    points: RewindPoint[];
    earlier: boolean;
    earlierBusy: boolean;
    loading: boolean;
    target: RewindPoint | null;
    preview: RewindPreview | null;
    busy: boolean;
    onSelect: (point: RewindPoint) => void;
    onEarlier: () => void;
    onRewind: (mode: "both" | "conversation") => void;
    onFork: () => void;
    onBack: () => void;
    onDismiss: () => void;
  }

  const {
    points,
    earlier,
    earlierBusy,
    loading,
    target,
    preview,
    busy,
    onSelect,
    onEarlier,
    onRewind,
    onFork,
    onBack,
    onDismiss,
  }: Props = $props();

  const codeAvailable = $derived(preview?.canRewind !== false);
  const forkOnly = $derived(target?.forkOnly === true);

  let mode = $state<"both" | "conversation" | "fork">("both");

  const both = $derived(mode === "both");

  $effect(() => {
    if (forkOnly) mode = "fork";
    else if (preview !== null && !preview.canRewind && mode === "both") mode = "conversation";
  });

  const ordered = $derived([...points].reverse());
</script>

{#if target}
  <CompactDialog title={t("REWIND")} onDismiss={() => !busy && onBack()}>
    {#snippet buttons()}
      <Button onclick={onBack} variant="outlined" enabled={!busy}>{t("CANCEL")}</Button>
      {#if mode === "fork"}
        <Button onclick={onFork} enabled={!busy}>{t("ACCEPT")}</Button>
      {:else}
        <Button variant="destructive" onclick={() => onRewind(both ? "both" : "conversation")} enabled={!busy}>
          {t("ACCEPT")}
        </Button>
      {/if}
    {/snippet}

    <CardPanel>
      <p class="selectable line-clamp-3 text-body-md">{readableText(target.text) || target.id}</p>
      {#if both}
        <p class="flex items-center gap-1 text-label-md text-on-surface-variant">
          {#if preview === null}
            <StatusDot loading />
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
    </CardPanel>

    <div class="h-2"></div>
    <DialogSelectItem
      label={t("REWIND_BOTH")}
      selected={both}
      enabled={!busy && codeAvailable && !forkOnly}
      onclick={() => (mode = "both")}
    />
    <DialogSelectItem
      label={t("REWIND_CONVERSATION")}
      selected={mode === "conversation"}
      enabled={!busy && !forkOnly}
      onclick={() => (mode = "conversation")}
    />
    <DialogSelectItem
      label={t("FORK_FROM_HERE")}
      selected={mode === "fork"}
      enabled={!busy}
      onclick={() => (mode = "fork")}
    />
  </CompactDialog>
{:else}
  <CompactDialog title={t("REWIND")} {onDismiss}>
    {#snippet buttons()}
      <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}

    {#if loading}
      <CenteredProgress class="py-6" />
    {:else}
      {#if !points.length}
        <EmptyState text={t("REWIND_EMPTY")} />
      {/if}
      {#if points.length || earlier}
        <div class="flex flex-col gap-2 pb-2">
          {#each ordered as point (point.id)}
            <CardPanel onclick={() => onSelect(point)} class="w-full text-left">
              <p class="line-clamp-2 text-body-md">{readableText(point.text) || point.id}</p>
            </CardPanel>
          {/each}
          {#if earlier}
            <ActionButton text={t("EARLIER_POINTS")} enabled={!earlierBusy} onclick={onEarlier} class="w-full" />
          {/if}
        </div>
      {/if}
    {/if}
  </CompactDialog>
{/if}
