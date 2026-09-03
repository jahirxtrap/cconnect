<script lang="ts">
  import { formatSize } from "$lib/data/format";
  import { formatLogTime } from "$lib/data/time";
  import { osColor, osIconPath } from "$lib/design/osIcons";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import { COMPACT_WIDTH } from "$lib/platform/layout.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import Sparkline from "$lib/ui/Sparkline.svelte";
  import { animateScrollLeft } from "$lib/ui/animateScroll";
  import { monitor } from "./monitor.svelte";
  import NetworkPage from "./NetworkPage.svelte";

  const pane = inPane();

  const FOLLOW_SLACK_PX = 24;
  const SECONDS_PER_DAY = 86_400;
  const SECONDS_PER_HOUR = 3_600;
  const SECONDS_PER_MINUTE = 60;
  const MILLIS_PER_SECOND = 1000;

  let page = $state(0);
  let width = $state(0);
  let logBox = $state<HTMLDivElement | null>(null);
  let pager = $state<HTMLDivElement | null>(null);
  let followLogs = true;

  const narrow = $derived(width < COMPACT_WIDTH);
  const hasNetwork = $derived(monitor.network?.supported === true);
  const labels = $derived(
    hasNetwork ? [t("RESOURCES"), t("NETWORK"), t("SERVER_LOGS")] : [t("RESOURCES"), t("SERVER_LOGS")],
  );

  const goToPage = (index: number) => {
    const far = Math.abs(index - page) > 1;
    page = index;
    if (!pager) return;
    const target = index * pager.clientWidth;
    if (far) pager.scrollLeft = target;
    else animateScrollLeft(pager, target);
  };

  const onPagerScroll = () => {
    if (!pager) return;
    page = Math.round(pager.scrollLeft / pager.clientWidth);
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
    level === "ERROR" || level === "CRITICAL"
      ? "text-red"
      : level === "WARNING"
        ? "text-yellow"
        : "text-on-surface-variant";

  $effect(() => {
    void monitor.logRevision;
    if (!logBox) return;
    if (followLogs) logBox.scrollTop = logBox.scrollHeight;
    followLogs = logBox.scrollTop >= logBox.scrollHeight - logBox.clientHeight - FOLLOW_SLACK_PX;
  });
</script>

<div bind:clientWidth={width} class="flex min-h-0 flex-1 flex-col">
  {#if !monitor.info && monitor.offline}
    <EmptyState
      text={pane && serverStatus.unavailable ? t("SERVER_UNAVAILABLE") : t("CONNECTION_ERROR")}
      class="flex-1"
    />
  {:else if !monitor.info}
    <CenteredProgress class="flex-1" />
  {:else}
  {@const current = monitor.info}
  {@const gpu = monitor.gpu}
  <div class="px-4 py-1.5">
    <SegmentedButtons options={labels} selected={page} onSelect={goToPage} />
  </div>

  <div
    bind:this={pager}
    onscroll={onPagerScroll}
    class="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
  >
    <div class="flex w-full shrink-0 snap-center flex-col">
      <div class="min-h-0 flex-1 overflow-y-auto pb-4">
        <div class="flex gap-3 px-4 py-2 {narrow ? 'flex-col' : ''}">
          {@render graph("CPU", plural("CORES_COUNT", current.cpuCores), current.cpuPercent, monitor.cpuHistory)}
          {#if gpu}
            {@render graph(
              "GPU",
              [gpu.name.replace("NVIDIA GeForce ", ""), gpu.temp === null ? null : `${gpu.temp}°C`]
                .filter(Boolean)
                .join(" • "),
              gpu.percent,
              monitor.gpuHistory,
            )}
          {/if}
        </div>
        <div class="px-4 py-2">
          {@render graph(
            t("MEMORY"),
            `${formatSize(current.memoryUsed)} / ${formatSize(current.memoryTotal)}`,
            current.memoryPercent,
            monitor.memHistory,
          )}
        </div>
        {#if gpu}
          <div class="px-4 py-2">
            {@render graph(
              "VRAM",
              `${formatSize(gpu.memUsed)} / ${formatSize(gpu.memTotal)}`,
              gpu.memPercent,
              monitor.vramHistory,
            )}
          </div>
        {/if}

        {#if current.battery}
          {@const battery = current.battery}
          <div class="px-4 py-2">
            <MetricBar
              title={t("BATTERY")}
              subtitle={battery.plugged
                ? t("BATTERY_PLUGGED")
                : battery.secsLeft !== null
                  ? t("BATTERY_REMAINING", formatUptime(battery.secsLeft))
                  : t("BATTERY_ON_BATTERY")}
              percent={battery.percent}
              alert={battery.percent < 20 && !battery.plugged}
            />
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
    </div>

    {#if hasNetwork && monitor.network}
      <div class="flex w-full shrink-0 snap-center flex-col">
        <NetworkPage
          status={monitor.network}
          rxBytes={current.netRx}
          txBytes={current.netTx}
          onReload={() => monitor.reloadNetwork()}
        />
      </div>
    {/if}

    <div class="flex w-full shrink-0 snap-center flex-col">
      <div class="min-h-0 flex-1 px-4 pt-2 pb-4">
        <div
          bind:this={logBox}
          class="selectable scrollbar-thin h-full overflow-y-auto rounded-md bg-surface-variant px-3 py-2.5"
        >
          {#if !monitor.logs.length}
            <p class="text-body-sm text-on-surface-variant">{t("NO_LOGS")}</p>
          {/if}
          {#each monitor.logs as entry, index (index)}
            <div class="flex gap-2 py-0.5 font-mono text-body-sm">
              <span class="shrink-0 text-on-surface-variant/60">
                {formatLogTime(entry.ts * MILLIS_PER_SECOND)}
              </span>
              <span class="min-w-0 flex-1 wrap-anywhere whitespace-pre-wrap {levelClass(entry.level)}">
                {entry.message}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
  {/if}
</div>

{#snippet graph(title: string, subtitle: string, percent: number, history: number[])}
  <div class="min-w-0 flex-1">
    <MetricBar {title} {subtitle} {percent} />
    <Sparkline points={history} capacity={monitor.historyCap} class="mt-2 h-16 w-full" />
  </div>
{/snippet}

{#snippet infoRow(label: string, value: string)}
  <div class="flex items-center gap-3">
    <span class="shrink-0 text-body-sm text-on-surface-variant">{label}</span>
    <span class="min-w-0 flex-1 truncate text-right text-body-sm">{value}</span>
  </div>
{/snippet}
