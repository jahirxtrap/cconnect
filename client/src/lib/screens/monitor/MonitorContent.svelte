<script lang="ts">
  import BatteryCharging from "@lucide/svelte/icons/battery-charging";
  import BatteryFull from "@lucide/svelte/icons/battery-full";
  import BatteryLow from "@lucide/svelte/icons/battery-low";
  import BatteryMedium from "@lucide/svelte/icons/battery-medium";
  import Binary from "@lucide/svelte/icons/binary";
  import Cpu from "@lucide/svelte/icons/cpu";
  import Gpu from "@lucide/svelte/icons/gpu";
  import HardDrive from "@lucide/svelte/icons/hard-drive";
  import Layers from "@lucide/svelte/icons/layers";
  import MemoryStick from "@lucide/svelte/icons/memory-stick";
  import Monitor from "@lucide/svelte/icons/monitor";
  import { formatDecimal, formatSeconds, formatSize, formatUnit, joined } from "$lib/data/format";
  import { formatLogTime, MILLIS_PER_SECOND } from "$lib/data/time";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { osIcon } from "$lib/design/osIcons";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import { COMPACT_WIDTH } from "$lib/platform/layout.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import type { IconSource } from "$lib/ui/icons";
  import InfoRow from "$lib/ui/InfoRow.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import Sparkline from "$lib/ui/Sparkline.svelte";
  import { dockArea } from "$lib/ui/dockArea.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import TabPager, { TAB_PAGE_CLASS } from "$lib/ui/TabPager.svelte";
  import { monitor } from "./monitor.svelte";
  import MonitorTabs from "./MonitorTabs.svelte";
  import NetworkPage from "./NetworkPage.svelte";
  import ProcessesPage from "./ProcessesPage.svelte";

  const pane = inPane();

  const FOLLOW_SLACK_PX = 24;
  const LOW_BATTERY = 20;
  const PERCENT = 100;
  const BATTERY_LEVELS = [BatteryLow, BatteryMedium, BatteryFull];
  const WIDE_WIDTH = 880;
  const INSET = "px-(--page-inset) pb-(--page-inset)";
  const CARD_CLASS = "rounded-lg bg-card p-3.5";
  const ICON_CLASS = "shrink-0 text-on-surface-variant";

  let width = $state(0);
  let logBox = $state<HTMLDivElement | null>(null);
  let logRows = $state<HTMLDivElement | null>(null);
  let followLogs = true;
  let logAnchor: { node: Element; gap: number } | null = null;

  const OsIcon = $derived(osIcon(monitor.info?.osId));
  const narrow = $derived(width < COMPACT_WIDTH);
  const pairColumns = $derived(narrow ? "" : "grid-cols-2");
  const hasNetwork = $derived(monitor.network?.supported === true);

  const batteryIcon = (percent: number, plugged: boolean) =>
    plugged
      ? BatteryCharging
      : BATTERY_LEVELS[Math.min(BATTERY_LEVELS.length - 1, Math.floor((percent / PERCENT) * BATTERY_LEVELS.length))];

  const levelClass = (level: string) =>
    level === "ERROR" || level === "CRITICAL"
      ? "text-red"
      : level === "WARNING"
        ? "text-yellow"
        : "text-on-surface-variant";

  const offsetIn = (node: Element, box: HTMLElement) => node.getBoundingClientRect().top - box.getBoundingClientRect().top;

  const trackLogs = () => {
    if (logBox) followLogs = logBox.scrollTop >= logBox.scrollHeight - logBox.clientHeight - FOLLOW_SLACK_PX;
  };

  $effect.pre(() => {
    void monitor.logRevision;
    logAnchor = null;
    const box = logBox;
    if (!box || !logRows || followLogs) return;
    const node = [...logRows.children].findLast((row) => offsetIn(row, box) < box.clientHeight);
    if (node) logAnchor = { node, gap: offsetIn(node, box) };
  });

  $effect(() => {
    void monitor.logRevision;
    if (!logBox) return;
    if (followLogs) logBox.scrollTop = logBox.scrollHeight;
    else if (logAnchor?.node.isConnected) logBox.scrollTop += offsetIn(logAnchor.node, logBox) - logAnchor.gap;
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

  <TabPager selected={monitor.page} onSelect={(index) => monitor.select(index)} class="min-h-0 flex-1">
    <div class={TAB_PAGE_CLASS}>
      <div use:viewportScrollbar use:dockArea class="rounded-viewport min-h-0 flex-1 overflow-y-auto {INSET}">
        <div class="flex flex-col gap-2.5">
          <div class="grid gap-2.5 {width >= WIDE_WIDTH ? 'grid-cols-4' : 'grid-cols-2'}">
            {@render graph(Cpu, "CPU", plural("CORES_COUNT", current.cpuCores), current.cpuPercent, monitor.cpuHistory)}
            {#if gpu}
              {@render graph(
                Gpu,
                "GPU",
                joined(gpu.name.replace("NVIDIA GeForce ", ""), gpu.temp === null ? null : formatUnit(gpu.temp, "celsius")),
                gpu.percent,
                monitor.gpuHistory,
              )}
            {/if}
            {@render graph(
              MemoryStick,
              t("MEMORY"),
              `${formatSize(current.memoryUsed)} / ${formatSize(current.memoryTotal)}`,
              current.memoryPercent,
              monitor.memHistory,
            )}
            {#if gpu}
              {@render graph(
                Layers,
                "VRAM",
                `${formatSize(gpu.memUsed)} / ${formatSize(gpu.memTotal)}`,
                gpu.memPercent,
                monitor.vramHistory,
              )}
            {/if}
          </div>

          {#if current.battery || current.disks.length}
            <div class="grid gap-2.5 {pairColumns}">
              {#if current.battery}
                {@const battery = current.battery}
                <MetricBar
                  icon={batteryIcon(battery.percent, battery.plugged)}
                  inline
                  title={t("BATTERY")}
                  subtitle={battery.plugged
                    ? t("BATTERY_PLUGGED")
                    : battery.secsLeft !== null
                      ? t("BATTERY_REMAINING", formatSeconds(battery.secsLeft))
                      : t("BATTERY_ON_BATTERY")}
                  percent={battery.percent}
                  alert={battery.percent < LOW_BATTERY && !battery.plugged}
                  class={CARD_CLASS}
                />
              {/if}
              {#each current.disks as disk (disk.mount)}
                <MetricBar
                  icon={HardDrive}
                  inline
                  title={disk.mount}
                  subtitle="{formatSize(disk.used)} / {formatSize(disk.total)}"
                  percent={disk.percent}
                  class={CARD_CLASS}
                />
              {/each}
            </div>
          {/if}
        </div>

        <SettingsGroup label={t("INFORMATION")}>
          <div class="flex flex-col gap-2.5 p-3">
            <div class="mb-1 flex items-center gap-3">
              {#if OsIcon}
                <OsIcon class="size-8 shrink-0" aria-hidden="true" />
              {:else}
                <Monitor size={32} class={ICON_CLASS} />
              {/if}
              <div class="min-w-0">
                <p class="truncate text-title-md">{current.os}</p>
                <p class="truncate text-body-sm text-on-surface-variant">
                  {joined(current.hostname, formatSeconds(current.uptime))}
                </p>
              </div>
            </div>
            {#if current.cpuName}
              <InfoRow icon={Cpu} label="CPU" value={current.cpuName} />
            {/if}
            {#if gpu}
              <InfoRow icon={Gpu} label="GPU" value={gpu.name} />
            {/if}
            <InfoRow icon={MemoryStick} label={t("MEMORY")} value={formatSize(current.memoryTotal)} />
            {#if gpu}
              <InfoRow icon={Layers} label="VRAM" value={formatSize(gpu.memTotal)} />
            {/if}
            {#if current.arch}
              <InfoRow icon={Binary} label={t("ARCHITECTURE")} value={current.arch} />
            {/if}
          </div>
        </SettingsGroup>
      </div>
    </div>

    <div class={TAB_PAGE_CLASS}>
      {#if monitor.processes}
        <ProcessesPage snapshot={monitor.processes} info={current} />
      {:else}
        <CenteredProgress class="flex-1" />
      {/if}
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
        <ScrollCard
          bind:scroller={logBox}
          dock
          onscroll={trackLogs}
          frame="h-full rounded-lg"
          class="selectable scrollbar-thin"
        >
          <div bind:this={logRows} class="px-2.5 py-2">
            {#if !monitor.logs.length}
              <p class="text-body-sm text-on-surface-variant">{t("NO_LOGS")}</p>
            {/if}
            {#each monitor.logs as entry (entry.id)}
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

{#snippet graph(Icon: IconSource, title: string, detail: string, percent: number, history: number[])}
  <div class="min-w-0 {CARD_CLASS}">
    <div class="flex min-w-0 {narrow ? 'flex-col' : 'items-center gap-2'}">
      <div class="flex shrink-0 items-center gap-2">
        <Icon size={16} class={ICON_CLASS} />
        <p class="text-item-title">{title}</p>
      </div>
      <p class="min-w-0 truncate text-body-sm text-on-surface-variant {narrow ? '' : 'flex-1 text-right'}">{detail}</p>
    </div>
    <p class="mt-2 text-metric">
      {formatDecimal(percent, 0)}<span class="ml-0.5 text-body-md text-on-surface-variant">%</span>
    </p>
    <Sparkline points={history} capacity={monitor.historyCap} class="mt-2 h-14 w-full" />
  </div>
{/snippet}
