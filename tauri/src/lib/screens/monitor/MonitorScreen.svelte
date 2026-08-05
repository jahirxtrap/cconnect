<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Server from "@lucide/svelte/icons/server";
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import { navigation } from "$lib/app/navigation.svelte";
  import { formatSize } from "$lib/data/format";
  import { formatClock } from "$lib/data/time";
  import { osColor, osIconPath } from "$lib/design/osIcons";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import { networkApi, type NetworkStatus } from "$lib/services/networkApi";
  import { systemApi, type GpuInfo, type LogEntry, type SystemInfo } from "$lib/services/systemApi";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import Sparkline from "$lib/ui/Sparkline.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import NetworkPage from "./NetworkPage.svelte";

  const HISTORY_CAP = 90;
  const LOG_CAP = 300;
  const FOLLOW_SLACK_PX = 24;
  const SECONDS_PER_DAY = 86_400;
  const SECONDS_PER_HOUR = 3_600;
  const SECONDS_PER_MINUTE = 60;
  const MILLIS_PER_SECOND = 1000;

  let info = $state<SystemInfo | null>(null);
  let gpu = $state<GpuInfo | null>(null);
  let failed = $state(false);
  let cpuHistory = $state<number[]>([]);
  let gpuHistory = $state<number[]>([]);
  let memHistory = $state<number[]>([]);
  let vramHistory = $state<number[]>([]);
  let logs = $state<LogEntry[]>([]);
  let network = $state<NetworkStatus | null>(null);
  let page = $state(0);
  let envOpen = $state(false);
  let restartOpen = $state(false);
  let logBox = $state<HTMLDivElement | null>(null);
  let followLogs = true;

  const environment = $derived(backend.active);
  const hasNetwork = $derived(network?.supported === true);
  const labels = $derived(
    hasNetwork
      ? [t("RESOURCES"), t("NETWORK"), t("SERVER_LOGS")]
      : [t("RESOURCES"), t("SERVER_LOGS")],
  );
  const logsPage = $derived(hasNetwork ? 2 : 1);

  const append = (history: number[], value: number) => [...history, value].slice(-HISTORY_CAP);

  const reloadNetwork = () => {
    void networkApi.status().then((status) => (network = status));
  };

  const formatUptime = (seconds: number) => {
    const total = Math.floor(seconds);
    const days = Math.floor(total / SECONDS_PER_DAY);
    const hours = Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const levelClass = (level: string) =>
    level === "ERROR" || level === "CRITICAL" ? "text-red" : level === "WARNING" ? "text-yellow" : "text-on-surface-variant";

  $effect(() => {
    void backend.activeId;
    info = null;
    gpu = null
    failed = false;
    cpuHistory = [];
    gpuHistory = [];
    memHistory = [];
    vramHistory = [];
    logs = [];
    reloadNetwork();
    const socket = systemApi.stream({
      onInfo: (snapshot) => {
        failed = false;
        info = snapshot;
        cpuHistory = append(cpuHistory, snapshot.cpuPercent);
        memHistory = append(memHistory, snapshot.memoryPercent);
        if (snapshot.gpu) {
          gpu = snapshot.gpu;
          gpuHistory = append(gpuHistory, snapshot.gpu.percent);
          vramHistory = append(vramHistory, snapshot.gpu.memPercent);
        }
      },
      onLogs: (items) => {
        followLogs = !logBox || logBox.scrollTop >= logBox.scrollHeight - logBox.clientHeight - FOLLOW_SLACK_PX;
        logs = [...logs, ...items].slice(-LOG_CAP);
      },
      onDrop: () => (failed = true),
    });
    return () => socket.close();
  });

  $effect(() => {
    void logs.length;
    if (followLogs && logBox) logBox.scrollTop = logBox.scrollHeight;
  });
</script>

<div class="flex h-full flex-col">
  <AppTopBar title={t("MONITOR")} subtitle={failed ? t("SERVER_UNAVAILABLE") : (environment?.name ?? null)}>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
    {#snippet subtitleLeading()}
      {#if failed}
        <StatusDot class="bg-red" box={8} />
      {/if}
    {/snippet}
    {#snippet actions()}
      <TooltipIconButton
        label={t("RESTART_SERVER")}
        enabled={!failed && info !== null}
        onclick={() => (restartOpen = true)}
      >
        <ServerCog size={20} />
      </TooltipIconButton>
      <TooltipIconButton label={t("ENVIRONMENT")} onclick={() => (envOpen = true)}>
        <Server size={20} />
      </TooltipIconButton>
    {/snippet}
  </AppTopBar>

  {#if !info && failed}
    <EmptyState text={t("CONNECTION_ERROR")} class="flex-1" />
  {:else if !info}
    <CenteredProgress class="flex-1" />
  {:else}
    {@const current = info}
    <div class="px-4 py-1.5">
      <SegmentedButtons options={labels} selected={page} onSelect={(index) => (page = index)} />
    </div>

    {#if page === 0}
      <div class="min-h-0 flex-1 overflow-y-auto pb-4">
        <div class="flex gap-3 px-4 py-2">
          {@render graph("CPU", plural("CORES_COUNT", current.cpuCores), current.cpuPercent, cpuHistory)}
          {#if gpu}
            {@render graph(
              "GPU",
              [gpu.name.replace("NVIDIA GeForce ", ""), gpu.temp === null ? null : `${gpu.temp}°C`]
                .filter(Boolean)
                .join(" • "),
              gpu.percent,
              gpuHistory,
            )}
          {/if}
        </div>
        <div class="px-4 py-2">
          {@render graph(
            t("MEMORY"),
            `${formatSize(current.memoryUsed)} / ${formatSize(current.memoryTotal)}`,
            current.memoryPercent,
            memHistory,
          )}
        </div>
        {#if gpu}
          <div class="px-4 py-2">
            {@render graph(
              "VRAM",
              `${formatSize(gpu.memUsed)} / ${formatSize(gpu.memTotal)}`,
              gpu.memPercent,
              vramHistory,
            )}
          </div>
        {/if}

        <div class="px-4">
          <SettingsGroup label={t("STORAGE")}>
          <div class="flex flex-col gap-3.5 p-4">
            {#each current.disks as disk (disk.mount)}
              <MetricBar
                title={disk.mount}
                subtitle="{formatSize(disk.used)} / {formatSize(disk.total)}"
                percent={disk.percent}
              />
            {/each}
          </div>
          </SettingsGroup>
        </div>

        <div class="px-4">
          <SettingsGroup label={t("INFORMATION")}>
          <div class="flex flex-col gap-2.5 p-4">
            <div class="flex items-center gap-3.5">
              {#if osIconPath(current.osId)}
                <svg
                  viewBox="0 0 24 24"
                  class="size-8 shrink-0"
                  style={osColor(current.osId) ? `color: ${osColor(current.osId)}` : ""}
                  aria-hidden="true"
                >
                  <path d={osIconPath(current.osId)} fill="currentColor" />
                </svg>
              {/if}
              <div class="min-w-0">
                <p class="truncate text-body-lg">{current.os}</p>
                <p class="truncate text-body-sm text-on-surface-variant">
                  {current.hostname} • {formatUptime(current.uptime)}
                </p>
              </div>
            </div>
            {#if current.cpuName}
              {@render infoRow("CPU", current.cpuName)}
            {/if}
            {#if gpu}
              {@render infoRow("GPU", gpu.name)}
            {/if}
            {@render infoRow(t("MEMORY"), formatSize(current.memoryTotal))}
            {#if gpu}
              {@render infoRow("VRAM", formatSize(gpu.memTotal))}
            {/if}
            {#if current.arch}
              {@render infoRow(t("ARCHITECTURE"), current.arch)}
            {/if}
          </div>
          </SettingsGroup>
        </div>
      </div>
    {:else if hasNetwork && page === 1 && network}
      <NetworkPage status={network} rxBytes={current.netRx} txBytes={current.netTx} onReload={reloadNetwork} />
    {:else if page === logsPage}
      <div class="min-h-0 flex-1 px-4 pt-2 pb-4">
        <div
          bind:this={logBox}
          class="selectable scrollbar-thin h-full overflow-y-auto rounded-md bg-surface-variant px-3 py-2.5"
        >
          {#if !logs.length}
            <p class="text-body-sm text-on-surface-variant">{t("NO_LOGS")}</p>
          {/if}
          {#each logs as entry, index (index)}
            <div class="flex gap-2 py-0.5 font-mono text-body-sm">
              <span class="shrink-0 text-on-surface-variant/60">
                {formatClock(entry.ts * MILLIS_PER_SECOND)}
              </span>
              <span class="whitespace-pre-wrap {levelClass(entry.level)}">{entry.message}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

{#snippet graph(title: string, subtitle: string, percent: number, history: number[])}
  <div class="min-w-0 flex-1">
    <MetricBar {title} {subtitle} {percent} />
    <Sparkline points={history} capacity={HISTORY_CAP} class="mt-2 h-16 w-full" />
  </div>
{/snippet}

{#snippet infoRow(label: string, value: string)}
  <div class="flex items-center gap-3">
    <span class="shrink-0 text-body-sm text-on-surface-variant">{label}</span>
    <span class="min-w-0 flex-1 truncate text-right text-body-sm">{value}</span>
  </div>
{/snippet}

{#if envOpen}
  <SelectDialog
    title={t("ENVIRONMENT")}
    options={backend.environments.map((profile) => ({
      value: profile.id,
      label: profile.name,
      subtitle: address(profile),
    }))}
    selected={backend.activeId ?? ""}
    onSelect={(id) => backend.select(id)}
    onDismiss={() => (envOpen = false)}
  />
{/if}

{#if restartOpen}
  <ConfirmDialog
    title={t("RESTART_SERVER")}
    text={t("RESTART_SERVER_CONFIRM")}
    confirmLabel={t("CONFIRM")}
    onConfirm={() => {
      restartOpen = false;
      void systemApi.restart();
    }}
    onDismiss={() => (restartOpen = false)}
  />
{/if}
