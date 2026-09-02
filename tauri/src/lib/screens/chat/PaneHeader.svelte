<script lang="ts">
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";
  import { PANE_HEADER_CLASS, paneFocusBorder } from "./paneChrome";
  import PaneViewMenu from "./PaneViewMenu.svelte";

  interface Props {
    title: string;
    actions?: Snippet;
  }

  const { title, actions }: Props = $props();

  const focused = $derived(panes.focused === "right");
</script>

<div class="gap-1 pr-1 pl-3 {PANE_HEADER_CLASS} {paneFocusBorder(focused)}">
  <p class="min-w-0 flex-1 truncate text-label-lg">{title}</p>
  {@render actions?.()}
  <PaneViewMenu />
  <TooltipIconButton
    label={t("PANEL_RIGHT")}
    shortcut="panel.right"
    class="size-8"
    onclick={() => panes.setOpen(false)}
  >
    <PanelRightClose />
  </TooltipIconButton>
</div>
