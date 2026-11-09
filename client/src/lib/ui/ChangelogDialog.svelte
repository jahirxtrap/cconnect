<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import type { ReleaseNotes } from "$lib/services/githubApi";
  import Button from "./Button.svelte";
  import CenteredProgress from "./CenteredProgress.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import EmptyState from "./EmptyState.svelte";
  import MarkdownText from "./MarkdownText.svelte";
  import { nearView } from "./nearView";

  interface Props {
    load: () => Promise<ReleaseNotes[] | null>;
    onDismiss: () => void;
    limitHeight?: boolean;
  }

  const { load, onDismiss, limitHeight = true }: Props = $props();

  const BATCH = 5;

  let loaded = $state<ReleaseNotes[] | null>(null);
  let failed = $state(false);
  let painted = $state(false);
  let shown = $state(BATCH);

  const notes = $derived(painted ? loaded : null);

  $effect(() => {
    void load().then((result) => {
      if (result) loaded = result;
      else failed = true;
    });
  });
</script>

<CompactDialog title={t("CHANGELOG")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  {#if failed}
    <EmptyState text={t("UPDATE_CHECK_FAILED")} class="py-6" />
  {:else if !notes}
    <div use:nearView={() => (painted = true)} class="w-full">
      <CenteredProgress class="w-full py-6" />
    </div>
  {:else}
    <div class="selectable flex flex-col gap-4 {limitHeight ? 'max-h-[420px]' : ''}">
      {#each notes.slice(0, shown) as release (release.tag)}
        <div>
          <p class="text-title-md text-accent">{release.tag}</p>
          <MarkdownText text={release.body} class="mt-1" />
        </div>
      {/each}
      {#if shown < notes.length}
        {#key shown}
          <div use:nearView={() => (shown += BATCH)}></div>
        {/key}
      {/if}
    </div>
  {/if}
</CompactDialog>
