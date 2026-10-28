<script lang="ts">
  import type { Snippet } from "svelte";
  import Menu from "@lucide/svelte/icons/menu";
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import ScreenBar from "$lib/app/ScreenBar.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import EnvironmentSelector from "./EnvironmentSelector.svelte";

  interface Props {
    environmentId: string | null;
    onEnvironment: (id: string) => void;
    onNewChat: () => void;
    drawerMode: boolean;
    onClose: (() => void) | null;
    tools: Snippet;
    children: Snippet;
  }

  const { environmentId, onEnvironment, onNewChat, drawerMode, onClose, tools, children }: Props = $props();
</script>

<div class="flex h-full min-h-0 flex-col gap-1 bg-surface pt-2.5 pb-2">
  <div class="mb-1 flex shrink-0 items-center px-2">
    <EnvironmentSelector class="flex-1" selected={environmentId} onSelect={onEnvironment} />
    <TooltipIconButton label={t("NEW_CHAT")} onclick={onNewChat}>
      <SquarePen />
    </TooltipIconButton>
    {#if onClose}
      <TooltipIconButton label={t("MENU")} shortcut="panel.left" onclick={onClose}>
        {#if drawerMode}
          <Menu />
        {:else}
          <PanelLeftClose />
        {/if}
      </TooltipIconButton>
    {/if}
  </div>

  {@render tools()}

  {@render children()}

  <div class="flex shrink-0 items-center px-2 pt-1.5">
    <ScreenBar />
  </div>
</div>
