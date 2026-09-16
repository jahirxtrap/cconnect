<script lang="ts">
  import MessageSquareText from "@lucide/svelte/icons/message-square-text";
  import { SCREENS, type ScreenEntry } from "$lib/app/screens";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";

  type PaneView = Pick<ScreenEntry, "kind" | "label" | "icon">;

  interface Props {
    class?: string;
  }

  const { class: className = "size-8" }: Props = $props();

  const CHAT_VIEW: PaneView = { kind: "chat", label: "CHAT", icon: MessageSquareText };

  const VIEWS = $derived<PaneView[]>(layout.mobile ? SCREENS : [CHAT_VIEW, ...SCREENS]);

  let menu = $state(false);

  const current = $derived(VIEWS.find((view) => view.kind === panes.kind) ?? VIEWS[0]);
</script>

<PopupMenu open={menu} onOpenChange={(value) => (menu = value)} label={t("PANEL_VIEW")} align="end">
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("PANEL_VIEW")} class={className} {...props}>
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
