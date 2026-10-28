<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import X from "@lucide/svelte/icons/x";
  import type { TerminalConnector, TerminalStatus } from "$lib/data/terminalLink";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import SoftKeys from "./SoftKeys.svelte";
  import type TerminalSurface from "./TerminalSurface.svelte";

  interface Props {
    title: string;
    connect: TerminalConnector;
    onClose: () => void;
    unavailable?: boolean;
  }

  const { title, connect, onClose, unavailable = false }: Props = $props();

  let status = $state<TerminalStatus>("connecting");
  let pane = $state<ReturnType<typeof TerminalSurface> | null>(null);
  let Surface = $state<typeof TerminalSurface | null>(null);

  $effect(() => {
    if (unavailable || Surface) return;
    void import("./TerminalSurface.svelte").then((module) => (Surface = module.default));
  });

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
  <StatusDot class={status === "connected" ? "bg-green" : "bg-red"} loading={status === "connecting"} />
{/snippet}

{#snippet sessionActions()}
  <TooltipIconButton
    label={t("SSH_DISCONNECT")}
    onclick={() => {
      pane?.disconnect();
      onClose();
    }}
  >
    <X />
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
        <ArrowLeft />
      </TooltipIconButton>
    {/snippet}
  </AppTopBar>

  {#if unavailable}
    <EmptyState text={t("WEB_UNAVAILABLE")} class="flex-1" />
  {:else if status === "failed"}
    <ConnectionError class="flex-1" />
  {:else}
    <div class="mx-(--page-inset) mb-(--page-inset) min-h-0 flex-1 overflow-hidden rounded-panel bg-terminal">
      {#if Surface}
        <Surface bind:this={pane} {connect} onStatus={(next) => (status = next)} />
      {/if}
    </div>
    {#if isTouch}
      <div class="flex shrink-0 items-center gap-2 px-(--page-inset) pb-(--page-inset)">
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
