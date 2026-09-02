<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import X from "@lucide/svelte/icons/x";
  import type { TerminalConnector, TerminalStatus } from "$lib/data/terminalLink";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import SoftKeys from "./SoftKeys.svelte";
  import TerminalSurface from "./TerminalSurface.svelte";
  import { TERMINAL_BACKGROUND } from "./theme";

  interface Props {
    title: string;
    connect: TerminalConnector;
    onClose: () => void;
    unavailable?: boolean;
  }

  const { title, connect, onClose, unavailable = false }: Props = $props();

  let status = $state<TerminalStatus>("connecting");
  let pane = $state<ReturnType<typeof TerminalSurface> | null>(null);

  const statusLabel = $derived(
    status === "connecting"
      ? t("SSH_CONNECTING")
      : status === "connected"
        ? t("SSH_CONNECTED")
        : status === "closed"
          ? t("SSH_CLOSED")
          : t("CONNECTION_ERROR"),
  );
</script>

{#snippet sessionStatus()}
  {#if status === "connecting"}
    <LoadingIndicator size={8} fill />
  {:else}
    <StatusDot class={status === "connected" ? "bg-green" : "bg-red"} box={8} />
  {/if}
{/snippet}

{#snippet sessionActions()}
  <TooltipIconButton
    label={t("SSH_DISCONNECT")}
    onclick={() => {
      pane?.disconnect();
      onClose();
    }}
  >
    <X size={20} />
  </TooltipIconButton>
{/snippet}

<div class="flex h-full flex-col">
  <AppTopBar
    {title}
    subtitle={unavailable ? null : statusLabel}
    subtitleLeading={unavailable ? undefined : sessionStatus}
    actions={unavailable ? undefined : sessionActions}
  >
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={onClose}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
  </AppTopBar>

  {#if unavailable}
    <EmptyState text={t("WEB_UNAVAILABLE")} class="flex-1" />
  {:else if status === "failed"}
    <EmptyState text={t("CONNECTION_ERROR")} class="flex-1" />
  {:else}
    <div class="min-h-0 flex-1" style="background: {TERMINAL_BACKGROUND}">
      <TerminalSurface bind:this={pane} {connect} onStatus={(next) => (status = next)} />
    </div>
    {#if isTouch}
      <div class="flex shrink-0 items-center gap-2 border-t border-outline-variant bg-surface px-3 py-2">
        <SoftKeys onKey={(bytes) => pane?.sendKey(bytes)} />
        <TooltipIconButton
          label={t("KEYBOARD")}
          tooltip={false}
          class="size-8"
          onclick={() => pane?.toggleKeyboard()}
        >
          <Keyboard />
        </TooltipIconButton>
      </div>
    {/if}
  {/if}
</div>
