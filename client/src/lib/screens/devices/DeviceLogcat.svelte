<script lang="ts">
  import type { DeviceInfo } from "$lib/data/deviceModels";
  import { joined } from "$lib/data/format";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import type { TerminalConnector, TerminalStatus } from "$lib/data/terminalLink";
  import { t } from "$lib/i18n/index.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import type TerminalSurface from "$lib/screens/terminal/TerminalSurface.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { closeTerminal, type TerminalInfo } from "$lib/services/terminalApi";
  import { localLink } from "$lib/services/terminalSocket";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import { SURFACE_FRAME_CLASS } from "$lib/ui/surfaceFrame";

  interface Props {
    device: DeviceInfo;
    session: TerminalInfo;
    onBack: () => void;
  }

  const { device, session, onBack }: Props = $props();

  let status = $state<TerminalStatus>("connecting");
  let pane = $state<ReturnType<typeof TerminalSurface> | null>(null);
  let Surface = $state<typeof TerminalSurface | null>(null);

  $effect(() => {
    if (Surface) return;
    void import("$lib/screens/terminal/TerminalSurface.svelte").then((module) => (Surface = module.default));
  });

  $effect(() => () => {
    pane?.disconnect();
    void closeTerminal(session.id);
  });

  const connect: TerminalConnector = (hooks, cols, rows) =>
    localLink(session.id, securityKeys.keyFor(backend.active), hooks, cols, rows);
</script>

<PaneHeader title={joined(t("DEVICE_LOGCAT"), device.name)} {onBack} />
{#if status === "failed"}
  <ConnectionError class="min-h-0 flex-1" />
{:else}
  <div class="{SURFACE_FRAME_CLASS} min-h-0 flex-1 bg-terminal">
    {#if Surface}
      <Surface bind:this={pane} {connect} autofocus={false} onStatus={(next) => (status = next)} />
    {/if}
  </div>
{/if}
