<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { navigation } from "./navigation.svelte";

  interface Props {
    title: string;
    subtitle?: string | null;
    refreshing?: boolean;
    onRefresh?: (() => void) | null;
    actions?: Snippet;
    toolbar?: Snippet;
    children?: Snippet;
  }

  const {
    title,
    subtitle,
    refreshing = false,
    onRefresh = null,
    actions,
    toolbar,
    children,
  }: Props = $props();
</script>

<div class="flex h-full flex-col">
  <AppTopBar {title} {subtitle} {actions}>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
  </AppTopBar>
  {@render toolbar?.()}
  <PullToRefresh {refreshing} {onRefresh}>
    {@render children?.()}
  </PullToRefresh>
</div>
