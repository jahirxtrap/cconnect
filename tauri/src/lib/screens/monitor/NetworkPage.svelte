<script lang="ts">
  import ArrowDownUp from "@lucide/svelte/icons/arrow-down-up";
  import Cable from "@lucide/svelte/icons/cable";
  import Gauge from "@lucide/svelte/icons/gauge";
  import Globe from "@lucide/svelte/icons/globe";
  import Wifi from "@lucide/svelte/icons/wifi";
  import { formatDecimal } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import {
    networkApi,
    type NetworkJob,
    type NetworkStatus,
    type SpeedtestResult,
    type WifiNetwork,
  } from "$lib/services/networkApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";

  interface Props {
    status: NetworkStatus;
    rxBytes: number;
    txBytes: number;
    onReload: () => void;
  }

  const { status, rxBytes, txBytes, onReload }: Props = $props();

  const BITS_PER_BYTE = 8;
  const GIGA = 1_000_000_000;
  const MEGA = 1_000_000;
  const KILO = 1_000;
  const PERCENT = 100;
  const JOB_POLL_MS = 2000;
  const JOB_ATTEMPTS = 30;

  let networks = $state<WifiNetwork[]>([]);
  let scanning = $state(false);
  let busy = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let passwordFor = $state<string | null>(null);
  let sudoPrompt = $state(false);
  let testing = $state(false);
  let testStage = $state("");
  let testProgress = $state(0);
  let result = $state<SpeedtestResult | null>(null);

  const formatBitrate = (bitsPerSecond: number) => {
    if (bitsPerSecond >= GIGA) return `${formatDecimal(bitsPerSecond / GIGA, 2)} Gb/s`;
    if (bitsPerSecond >= MEGA) return `${formatDecimal(bitsPerSecond / MEGA, 1)} Mb/s`;
    if (bitsPerSecond >= KILO) return `${formatDecimal(bitsPerSecond / KILO, 0)} kb/s`;
    return `${formatDecimal(bitsPerSecond, 0)} b/s`;
  };

  const formatMillis = (value: number | null) => (value === null ? "—" : `${formatDecimal(value, 1)} ms`);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const track = async (job: NetworkJob | null) => {
    if (!job) {
      notice = t("NETWORK_ACTION_FAILED");
      return;
    }
    if (job.status === "blocked") {
      notice = t("NETWORK_ACTION_BLOCKED");
      return;
    }
    notice = null;
    for (let attempt = 0; attempt < JOB_ATTEMPTS; attempt++) {
      await wait(JOB_POLL_MS);
      const current = await networkApi.job(job.id);
      if (!current) continue;
      if (current.status === "ok") return onReload();
      if (current.status === "rolled_back") {
        notice = t("NETWORK_ROLLED_BACK");
        return onReload();
      }
      if (current.status === "failed") {
        notice = current.message ?? t("NETWORK_ACTION_FAILED");
        return onReload();
      }
    }
    onReload();
  };

  const run = async (key: string, action: () => Promise<NetworkJob | null>) => {
    busy = key;
    await track(await action());
    busy = null;
  };

  const refreshScan = async () => {
    scanning = true;
    networks = await networkApi.scan();
    scanning = false;
  };

  const connectivityLabel = $derived(
    status.connectivity === "full"
      ? t("NETWORK_ONLINE")
      : status.connectivity === "portal"
        ? t("NETWORK_PORTAL")
        : status.connectivity === "limited"
          ? t("NETWORK_LIMITED")
          : t("NETWORK_OFFLINE"),
  );

  const connectivityDot = $derived(
    status.connectivity === "full"
      ? "bg-green"
      : status.connectivity === "portal" || status.connectivity === "limited"
        ? "bg-orange"
        : "bg-red",
  );

  const stageLabel = $derived(
    testStage === "download"
      ? t("NETWORK_DOWNLOAD")
      : testStage === "upload"
        ? t("NETWORK_UPLOAD")
        : testStage === "ping"
          ? t("NETWORK_PING")
          : t("NETWORK_TESTING"),
  );

  const startSpeedtest = () => {
    testing = true;
    result = null;
    testProgress = 0;
    testStage = "";
    const socket = networkApi.speedtest({
      onProgress: (stage, progress) => {
        testStage = stage;
        testProgress = Math.min(1, Math.max(0, progress));
      },
      onResult: (value) => {
        result = value;
        testing = false;
        socket.close();
      },
      onFailed: (message) => {
        notice = message;
        testing = false;
        socket.close();
      },
    });
  };

  $effect(() => {
    void refreshScan();
  });
</script>

<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
  <SettingsGroup label={t("NETWORK_STATE")}>
    {#snippet labelTrailing()}
      <StatusDot class={connectivityDot} box={20} dot={12} />
    {/snippet}
    <PreferenceRow
      icon={Globe}
      title={connectivityLabel}
      summary={status.interfaces.find((item) => item.internet)?.network ?? status.wifiSsid}
    />
    <PreferenceRow
      icon={ArrowDownUp}
      title={t("NETWORK_TRAFFIC")}
      summary="↓ {formatBitrate(rxBytes * BITS_PER_BYTE)}   ↑ {formatBitrate(txBytes * BITS_PER_BYTE)}"
    />
  </SettingsGroup>

  {#if notice}
    <p class="px-4 py-2 text-body-sm text-error">{notice}</p>
  {/if}

  <SettingsGroup label={t("NETWORK_INTERFACES")}>
    {#each status.interfaces.filter((item) => item.kind !== "other" || item.up) as item (item.name)}
      {@const controllable = status.wiredControl && item.kind === "wired"}
      <PreferenceRow
        icon={item.kind === "wifi" ? Wifi : Cable}
        title={item.name}
        summary={[item.network, item.linkSpeed].filter(Boolean).join(" • ") || null}
        onclick={controllable && !busy
          ? () => void run(item.name, () => networkApi.setInterface(item.name, !item.up))
          : undefined}
      >
        {#snippet trailing()}
          {#if busy === item.name}
            <LoadingIndicator size={20} />
          {:else if controllable}
            <CompactSwitch
              checked={item.up}
              onCheckedChange={() => void run(item.name, () => networkApi.setInterface(item.name, !item.up))}
            />
          {:else}
            <StatusDot
              class={item.internet ? "bg-green" : item.up ? "bg-orange" : "bg-outline-variant"}
              box={20}
              dot={12}
            />
          {/if}
        {/snippet}
      </PreferenceRow>
    {/each}
  </SettingsGroup>

  <SettingsGroup label={t("NETWORK_WIFI")}>
    {#snippet labelTrailing()}
      {#if scanning}
        <LoadingIndicator size={20} />
      {/if}
    {/snippet}
    {#if status.wifiRadio !== null}
      {@const radioOn = status.wifiRadio}
      <PreferenceRow
        icon={Wifi}
        title={t("NETWORK_WIFI_RADIO")}
        onclick={busy ? undefined : () => void run("radio", () => networkApi.setRadio(!radioOn))}
      >
        {#snippet trailing()}
          {#if busy === "radio"}
            <LoadingIndicator size={20} />
          {:else}
            <CompactSwitch
              checked={radioOn}
              onCheckedChange={() => void run("radio", () => networkApi.setRadio(!radioOn))}
            />
          {/if}
        {/snippet}
      </PreferenceRow>
    {/if}
    {#if !networks.length}
      <PreferenceRow icon={Wifi} title={t("NETWORK_NO_NETWORKS")} enabled={false} />
    {:else}
      {#each [...networks].sort((a, b) => (b.signal ?? 0) - (a.signal ?? 0)) as network (network.ssid)}
        <PreferenceRow
          icon={Wifi}
          title={network.ssid}
          summary={[network.signal === null ? null : t("NETWORK_SIGNAL", `${network.signal}%`), network.security]
            .filter(Boolean)
            .join(" • ") || null}
          onclick={network.active
            ? undefined
            : () =>
                network.known
                  ? void run(network.ssid, () => networkApi.connect(network.ssid, null))
                  : (passwordFor = network.ssid)}
        >
          {#snippet trailing()}
            {#if busy === network.ssid}
              <LoadingIndicator size={20} />
            {:else if network.active}
              <StatusDot class="bg-green" box={20} dot={12} />
            {/if}
          {/snippet}
        </PreferenceRow>
      {/each}
    {/if}
    <div class="px-4 py-3">
      <ActionButton text={t("REFRESH")} enabled={!scanning} onclick={() => void refreshScan()} class="w-full" />
    </div>
  </SettingsGroup>

  <SettingsGroup label={t("NETWORK_SPEED_TEST")}>
    {#if !status.speedtest}
      <PreferenceRow icon={Gauge} title={t("NETWORK_SPEEDTEST_MISSING")} enabled={false} />
    {:else}
      {#if result}
        <PreferenceRow
          icon={ArrowDownUp}
          title={t("NETWORK_DOWNLOAD")}
          summary={result.download === null ? "—" : formatBitrate(result.download)}
        />
        <PreferenceRow
          icon={ArrowDownUp}
          title={t("NETWORK_UPLOAD")}
          summary={result.upload === null ? "—" : formatBitrate(result.upload)}
        />
        <PreferenceRow
          icon={Gauge}
          title={t("NETWORK_PING")}
          summary="{formatMillis(result.ping)} • {t('NETWORK_JITTER')} {formatMillis(result.jitter)}"
        />
        {#if result.server}
          <PreferenceRow icon={Globe} title={result.server} summary={result.isp} />
        {/if}
      {/if}
      {#if testing}
        <div class="px-4 py-3">
          <div class="flex items-center">
            <span class="min-w-0 flex-1 text-body-lg">{stageLabel}</span>
            <span class="text-body-md text-on-surface-variant">
              {formatDecimal(testProgress * PERCENT, 0)}%
            </span>
          </div>
          <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-outline-variant">
            <div class="h-full rounded-full bg-accent transition-[width]" style="width: {testProgress * PERCENT}%"></div>
          </div>
        </div>
      {:else}
        <div class="px-4 py-3">
          <ActionButton text={t("NETWORK_RUN_TEST")} onclick={startSpeedtest} class="w-full" />
        </div>
      {/if}
    {/if}
  </SettingsGroup>

  {#if status.needsPassword}
    <SettingsGroup label={t("NETWORK_PERMISSIONS")}>
      <PreferenceRow
        icon={Cable}
        title={t("NETWORK_GRANT")}
        summary={t("NETWORK_PERMISSIONS_HINT")}
        onclick={() => (sudoPrompt = true)}
      />
    </SettingsGroup>
  {/if}
</div>

{#if passwordFor}
  {@const ssid = passwordFor}
  <RenameDialog
    initial=""
    title={ssid}
    confirmLabel={t("NETWORK_CONNECT")}
    secret
    onConfirm={(password) => {
      passwordFor = null;
      void run(ssid, () => networkApi.connect(ssid, password));
    }}
    onDismiss={() => (passwordFor = null)}
  />
{/if}

{#if sudoPrompt}
  <RenameDialog
    initial=""
    title={t("NETWORK_PERMISSIONS")}
    confirmLabel={t("NETWORK_GRANT")}
    secret
    onConfirm={(password) => {
      sudoPrompt = false;
      void networkApi.authorize(password).then(onReload);
    }}
    onDismiss={() => (sudoPrompt = false)}
  />
{/if}
