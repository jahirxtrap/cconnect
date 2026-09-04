<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import Power from "@lucide/svelte/icons/power";
  import Server from "@lucide/svelte/icons/server";
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { localServer, localServerStateOf } from "$lib/services/localServer.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import LocalServerDialog from "./LocalServerDialog.svelte";
  import { useSettingsDialog } from "./useSettingsDialog.svelte";
  import { localServerValue } from "./settingsValues";

  let confirm = $state<"restart" | "stop" | null>(null);
  let dialog = $state(false);

  useSettingsDialog("server", (target) => {
    if (target === "local_server") dialog = true;
  });
  let autoStart = $state(settings.localServerEnabled);

  const info = $derived(localServer.info);
  const phase = $derived(localServerStateOf(info));
  const live = $derived(phase === "running" || phase === "manual");

  const tone = $derived(
    live
      ? "bg-green"
      : phase === "failed"
        ? "bg-red"
        : phase === "starting"
          ? "bg-accent"
          : "bg-outline-variant",
  );

  const summary = $derived(localServerValue() || null);

  $effect(() => {
    let stop: (() => void) | null = null;
    void localServer.watch().then((unlisten) => (stop = unlisten));
    return () => stop?.();
  });
</script>

<SettingsGroup label={t("LOCAL_SERVER")}>
  {#snippet labelTrailing()}
    {#if phase === "starting"}
      <LoadingIndicator size={20} />
    {:else}
      <StatusDot class={tone} box={20} dot={12} />
    {/if}
  {/snippet}

  <PreferenceRow icon={Server} title={t("LOCAL_SERVER")} {summary} onclick={() => (dialog = true)}>
    {#snippet trailing()}
      <TooltipIconButton label={t("RESTART")} enabled={live} onclick={() => (confirm = "restart")}>
        <ServerCog size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("STOP")} enabled={live} onclick={() => (confirm = "stop")}>
        <Power size={20} />
      </TooltipIconButton>
      <TooltipIconButton
        label={t("RUN")}
        enabled={phase === "stopped" || phase === "failed"}
        onclick={() => localServer.start()}
      >
        <Play size={20} />
      </TooltipIconButton>
    {/snippet}
  </PreferenceRow>

  <PreferenceRow
    icon={Play}
    title={t("LOCAL_SERVER_START")}
    onclick={() => {
      autoStart = !autoStart;
      settings.localServerEnabled = autoStart;
    }}
  >
    {#snippet trailing()}
      <CompactSwitch
        checked={autoStart}
        onCheckedChange={(value) => {
          autoStart = value;
          settings.localServerEnabled = value;
        }}
      />
    {/snippet}
  </PreferenceRow>
</SettingsGroup>

{#if dialog}
  <LocalServerDialog onDismiss={() => (dialog = false)} />
{/if}

{#if confirm === "restart"}
  <ConfirmDialog
    title={t("RESTART_SERVER")}
    text={phase === "manual" ? t("RESTART_SERVER_MANUAL_CONFIRM") : t("RESTART_SERVER_CONFIRM")}
    confirmLabel={t("CONFIRM")}
    onConfirm={() => {
      confirm = null;
      localServer.restart();
    }}
    onDismiss={() => (confirm = null)}
  />
{:else if confirm === "stop"}
  <ConfirmDialog
    title={t("STOP_SERVER")}
    text={t("STOP_SERVER_CONFIRM")}
    confirmLabel={t("CONFIRM")}
    onConfirm={() => {
      confirm = null;
      localServer.stop();
    }}
    onDismiss={() => (confirm = null)}
  />
{/if}
