<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";

  interface Props {
    class?: string;
    size?: number;
  }

  const { class: className = "", size }: Props = $props();
</script>

<TooltipIconButton
  label={t("VIEW_IN_CENTER")}
  shortcut="panel.view"
  active={panes.centerView}
  class={className}
  onclick={() => panes.showCenterView(!panes.centerView)}
>
  <Eye {size} />
</TooltipIconButton>
