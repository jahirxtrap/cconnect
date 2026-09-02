<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Type from "@lucide/svelte/icons/type";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes, type RightKind } from "./panes.svelte";

  const VIEWS: { kind: RightKind; label: string; icon: typeof MessageSquare }[] = [
    { kind: "chat", label: "CHAT", icon: MessageSquare },
    { kind: "terminal", label: "TERMINAL", icon: SquareTerminal },
    { kind: "markdown", label: "MARKDOWN", icon: Type },
    { kind: "monitor", label: "MONITOR", icon: Activity },
  ];

  let menu = $state(false);

  const current = $derived(VIEWS.find((view) => view.kind === panes.kind) ?? VIEWS[0]);
</script>

<PopupMenu open={menu} onOpenChange={(value) => (menu = value)} label={t("PANEL_VIEW")} align="end">
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("PANEL_VIEW")} class="size-8" {...props}>
      <current.icon />
    </TooltipIconButton>
  {/snippet}
  {#each VIEWS as view (view.kind)}
    <MenuItem text={t(view.label)} onclick={() => panes.setKind(view.kind)}>
      {#snippet leading()}
        <view.icon size={20} class="shrink-0 {panes.kind === view.kind ? 'text-accent' : 'text-on-surface-variant'}" />
      {/snippet}
    </MenuItem>
  {/each}
</PopupMenu>
