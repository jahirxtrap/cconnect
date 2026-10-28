<script lang="ts">
  import { formatSize, joined } from "$lib/data/format";
  import { formatLogTime } from "$lib/data/time";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { osIcon } from "$lib/design/osIcons";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import { COMPACT_WIDTH } from "$lib/platform/layout.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import Sparkline from "$lib/ui/Sparkline.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import TabPager, { TAB_PAGE_CLASS } from "$lib/ui/TabPager.svelte";
  import { formatUptime, monitor } from "./monitor.svelte";
  import MonitorTabs from "./MonitorTabs.svelte";
  import NetworkPage from "./NetworkPage.svelte";

  const pane = inPane();

  const FOLLOW_SLACK_PX = 24;
  const MILLIS_PER_SECOND = 1000;
  const LOW_BATTERY = 20;
  const INSET = "px-(--page-inset) pb-(--page-inset)";
  const CARD_CLASS = "rounded-lg bg-card p-3.5";

  let width = $state(0);
  let logBox = $state<HTMLDivElement | null>(null);
  let followLogs = true;

  const OsIcon = $derived(osIcon(monitor.info?.osId));
  const narrow = $derived(width < COMPACT_WIDTH);
  const hasNetwork = $derived(monitor.network?.supported === true);

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
  {#if serverStatus.unavailable}
    <ServerUnavailable class="flex-1" />
  {:else if !monitor.info}
    <ConnectionError loading={!monitor.offline} class="flex-1" />
  {:else}
  {@const current = monitor.info}
  {@const gpu = monitor.gpu}
  {#if pane}
    <div class="px-(--page-inset) pb-2">
      <MonitorTabs fill />
    </div>
  {/if}

  <TabPager selected={monitor.page} onSelect={(index) => (monitor.page = index)} class="min-h-0 flex-1">
    <div class={TAB_PAGE_CLASS}>
      <div use:viewportScrollbar class="rounded-viewport min-h-0 flex-1 overflow-y-auto {INSET}">
        <div class="grid gap-2.5 {narrow ? '' : 'grid-cols-2'}">
          {@render graph("CPU", plural("CORES_COUNT", current.cpuCores), current.cpuPercent, monitor.cpuHistory)}
          {#if gpu}
            {@render graph(
              "GPU",
              joined(gpu.name.replace("NVIDIA GeForce ", ""), gpu.temp === null ? null : `${gpu.temp}°C`),
              gpu.percent,
              monitor.gpuHistory,
            )}
          {/if}
          {@render graph(
            t("MEMORY"),
            `${formatSize(current.memoryUsed)} / ${formatSize(current.memoryTotal)}`,
            current.memoryPercent,
            monitor.memHistory,
          )}
          {#if gpu}
            {@render graph(
              "VRAM",
              `${formatSize(gpu.memUsed)} / ${formatSize(gpu.memTotal)}`,
              gpu.memPercent,
              monitor.vramHistory,
            )}
          {/if}
          {#if current.battery}
            {@const battery = current.battery}
            <div class="col-span-full {CARD_CLASS}">
              <MetricBar
                title={t("BATTERY")}
                subtitle={battery.plugged
                  ? t("BATTERY_PLUGGED")
                  : battery.secsLeft !== null
                    ? t("BATTERY_REMAINING", formatUptime(battery.secsLeft))
                    : t("BATTERY_ON_BATTERY")}
                percent={battery.percent}
                alert={battery.percent < LOW_BATTERY && !battery.plugged}
              />
            </div>
          {/if}
        </div>

        {#if current.disks.length}
          <SettingsGroup label={t("STORAGE")}>
            <div class="flex flex-col gap-3.5 p-3">
              {#each current.disks as disk (disk.mount)}
                <MetricBar
                  title={disk.mount}
                  subtitle="{formatSize(disk.used)} / {formatSize(disk.total)}"
                  percent={disk.percent}
                />
              {/each}
            </div>
          </SettingsGroup>
        {/if}

        <SettingsGroup label={t("INFORMATION")}>
          <div class="flex flex-col gap-2.5 p-3">
            <div class="flex items-center gap-3.5">
              {#if OsIcon}
                <OsIcon class="size-8 shrink-0" aria-hidden="true" />
              {/if}
              <div class="min-w-0">
                <p class="truncate text-body-lg">{current.os}</p>
                <p class="truncate text-body-sm text-on-surface-variant">
                  {joined(current.hostname, formatUptime(current.uptime))}
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

    {#if hasNetwork && monitor.network}
      <div class={TAB_PAGE_CLASS}>
        <NetworkPage
          status={monitor.network}
          rxBytes={current.netRx}
          txBytes={current.netTx}
          onReload={() => monitor.reloadNetwork()}
        />
      </div>
    {/if}

    <div class={TAB_PAGE_CLASS}>
      <div class="min-h-0 flex-1 {INSET}">
        <ScrollCard bind:scroller={logBox} frame="h-full rounded-lg" class="selectable scrollbar-thin">
          <div class="px-2.5 py-2">
            {#if !monitor.logs.length}
              <p class="text-body-sm text-on-surface-variant">{t("NO_LOGS")}</p>
            {/if}
            {#each monitor.logs as entry, index (index)}
              <div class="flex gap-3 py-0.5 font-mono text-body-sm">
                <span class="shrink-0 text-faint">
                  {formatLogTime(entry.ts * MILLIS_PER_SECOND)}
                </span>
                <span class="min-w-0 flex-1 wrap-anywhere whitespace-pre-wrap {levelClass(entry.level)}">
                  {entry.message}
                </span>
              </div>
            {/each}
          </div>
        </ScrollCard>
      </div>
    </div>
  </TabPager>
  {/if}
</div>

{#snippet graph(title: string, subtitle: string, percent: number, history: number[])}
  <div class="min-w-0 {CARD_CLASS}">
    <MetricBar {title} {subtitle} {percent} />
    <Sparkline points={history} capacity={monitor.historyCap} class="mt-3 h-16 w-full" />
  </div>
{/snippet}

{#snippet infoRow(label: string, value: string)}
  <div class="flex items-center gap-3">
    <span class="shrink-0 text-body-sm text-on-surface-variant">{label}</span>
    <span class="min-w-0 flex-1 truncate text-right text-body-sm">{value}</span>
  </div>
{/snippet}
