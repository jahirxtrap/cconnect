<script lang="ts">
  import type { Snippet } from "svelte";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import PaneHeader from "./PaneHeader.svelte";
  import { panes } from "./panes.svelte";
  import type { PaneRole } from "./tabs.svelte";

  interface Props {
    role: PaneRole;
    focused: boolean;
    onNewChat: () => void;
    children: Snippet;
  }

  const { role, focused, onNewChat, children }: Props = $props();

  const close = () => (panes.history[role] = false);

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !focused) return false;
      close();
      return true;
    }),
  );
</script>

{#snippet newChat()}
  <TooltipIconButton
    label={t("NEW_CHAT")}
    onclick={() => {
      close();
      onNewChat();
    }}
  >
    <SquarePen />
  </TooltipIconButton>
{/snippet}

<div class="absolute inset-0 z-10 flex flex-col gap-1 bg-background pb-2">
  <PaneHeader title={t("CHATS")} onBack={close} actions={newChat} />
  {@render children()}
</div>
