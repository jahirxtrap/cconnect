<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import MarkdownActions from "./MarkdownActions.svelte";
  import MarkdownEditor from "./MarkdownEditor.svelte";
</script>

<div class="flex h-full flex-col">
  <AppTopBar title={t("MARKDOWN")}>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
    {#snippet actions()}
      <MarkdownActions />
    {/snippet}
  </AppTopBar>

  <MarkdownEditor />
</div>
