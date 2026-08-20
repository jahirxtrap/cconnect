<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import type { ReleaseNotes } from "$lib/services/githubApi";
  import Button from "./Button.svelte";
  import CenteredProgress from "./CenteredProgress.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import EmptyState from "./EmptyState.svelte";
  import MarkdownText from "./MarkdownText.svelte";

  interface Props {
    load: () => Promise<ReleaseNotes[] | null>;
    onDismiss: () => void;
    limitHeight?: boolean;
  }

  const { load, onDismiss, limitHeight = true }: Props = $props();

  let notes = $state<ReleaseNotes[] | null>(null);
  let failed = $state(false);

  $effect(() => {
    void load().then((result) => {
      if (result) notes = result;
      else failed = true;
    });
  });
</script>

<CompactDialog title={t("CHANGELOG")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  {#if failed}
    <EmptyState text={t("CONNECTION_ERROR")} class="py-6" />
  {:else if !notes}
    <CenteredProgress class="w-full py-6" />
  {:else}
    <div class="selectable flex flex-col gap-4 {limitHeight ? 'max-h-[420px]' : ''}">
      {#each notes as release (release.tag)}
        <div>
          <p class="text-title-md text-accent">{release.tag}</p>
          <MarkdownText text={release.body} class="mt-1" />
        </div>
      {/each}
    </div>
  {/if}
</CompactDialog>
