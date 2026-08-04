<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { navigation } from "./navigation.svelte";

  interface Props {
    title: string;
    subtitle?: string | null;
    actions?: Snippet;
    children?: Snippet;
  }

  const { title, subtitle, actions, children }: Props = $props();
</script>

<div class="flex h-full flex-col">
  <AppTopBar {title} {subtitle} {actions}>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
  </AppTopBar>
  <div class="min-h-0 flex-1 overflow-y-auto">
    {@render children?.()}
  </div>
</div>
