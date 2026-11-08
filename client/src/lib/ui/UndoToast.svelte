<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import FloatDock from "./FloatDock.svelte";
  import NoticeCard from "./NoticeCard.svelte";
  import { undoNotice } from "./undoNotice.svelte";
</script>

{#if undoNotice.current}
  {@const offer = undoNotice.current}
  <FloatDock stacked raised>
    {#key offer.id}
      <NoticeCard
        text={offer.text}
        actionLabel={t("UNDO")}
        onAction={() => undoNotice.undo()}
        onDismiss={() => undoNotice.dismiss()}
      />
    {/key}
  </FloatDock>
{/if}
