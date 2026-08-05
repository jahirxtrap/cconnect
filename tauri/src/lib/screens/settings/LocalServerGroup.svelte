<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import Power from "@lucide/svelte/icons/power";
  import Server from "@lucide/svelte/icons/server";
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { localServer } from "$lib/services/localServer.svelte";
  import { systemApi } from "$lib/services/systemApi";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import LocalServerDialog from "./LocalServerDialog.svelte";

  interface Props {
    serverReady: boolean;
  }

  const { serverReady }: Props = $props();

  let confirm = $state<"restart" | "stop" | null>(null);
  let dialog = $state(false);
  let autoStart = $state(settings.localServerEnabled);

  const info = $derived(localServer.info);
  const phase = $derived(localServer.state);

  const tone = $derived(
    phase === "running" || phase === "external"
      ? "bg-green"
      : phase === "failed"
        ? "bg-red"
        : phase === "starting"
          ? "bg-orange"
          : "bg-outline-variant",
  );

  const summary = $derived.by(() => {
    if (info.error === "bad_dir") return t("LOCAL_SERVER_BAD_DIR");
    if (info.error === "no_python") return t("LOCAL_SERVER_NO_PYTHON");
    if (info.error === "launch_failed") return t("LOCAL_SERVER_LAUNCH_FAILED");
    if (info.error === "crashed") return info.errorDetail ?? t("LOCAL_SERVER_STOPPED");
    if (phase === "running") return t("SSH_CONNECTED");
    if (phase === "starting") return t("CONNECTING");
    if (phase === "external") return t("LOCAL_SERVER_EXTERNAL");
    return null;
  });

  $effect(() => {
    let stop: (() => void) | null = null;
    void localServer.watch().then((unlisten) => (stop = unlisten));
    return () => stop?.();
  });
</script>

<SettingsGroup label={t("LOCAL_SERVER")}>
  {#snippet labelTrailing()}
    {#if phase === "starting"}
      <CenteredProgress size={20} />
    {:else}
      <StatusDot class={tone} />
    {/if}
  {/snippet}

  <PreferenceRow icon={Server} title={t("LOCAL_SERVER")} {summary} onclick={() => (dialog = true)}>
    {#snippet trailing()}
      <TooltipIconButton
        label={t("RESTART")}
        enabled={serverReady || info.managed}
        onclick={() => (confirm = "restart")}
      >
        <ServerCog size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("STOP")} enabled={info.managed} onclick={() => (confirm = "stop")}>
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
    text={t("RESTART_SERVER_CONFIRM")}
    confirmLabel={t("CONFIRM")}
    onConfirm={() => {
      confirm = null;
      if (serverReady) void systemApi.restart();
      else localServer.restart();
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
