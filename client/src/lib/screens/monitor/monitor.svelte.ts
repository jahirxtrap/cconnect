import { EnvironmentSlots } from "$lib/data/environmentSlots";
import { serverStatus } from "$lib/data/serverStatus.svelte";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "$lib/data/time";
import { backend } from "$lib/services/backend.svelte";
import { networkApi, type NetworkStatus } from "$lib/services/networkApi";
import { systemApi, type GpuInfo, type LogEntry, type ProcessesSnapshot, type SystemInfo } from "$lib/services/systemApi";

const HISTORY_CAP = 90;
const LOG_CAP = 300;
const RESOURCES_PAGE = "RESOURCES";

const append = (history: number[], value: number) => [...history, value].slice(-HISTORY_CAP);

interface MonitorSnapshot {
  info: SystemInfo | null;
  gpu: GpuInfo | null;
  network: NetworkStatus | null;
  logs: LogEntry[];
  processes: ProcessesSnapshot | null;
  cpuHistory: number[];
  gpuHistory: number[];
  memHistory: number[];
  vramHistory: number[];
}

const blank: MonitorSnapshot = {
  info: null,
  gpu: null,
  network: null,
  logs: [],
  processes: null,
  cpuHistory: [],
  gpuHistory: [],
  memHistory: [],
  vramHistory: [],
};


export const formatUptime = (seconds: number) => {
  const total = Math.floor(seconds);
  const days = Math.floor(total / SECONDS_PER_DAY);
  const hours = Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

class Monitor {
  readonly historyCap = HISTORY_CAP;

  info = $state<SystemInfo | null>(null);
  gpu = $state<GpuInfo | null>(null);
  failed = $state(false);

  readonly offline = $derived(this.failed || serverStatus.unavailable);
  cpuHistory = $state<number[]>([]);
  gpuHistory = $state<number[]>([]);
  memHistory = $state<number[]>([]);
  vramHistory = $state<number[]>([]);
  logs = $state<LogEntry[]>([]);
  network = $state<NetworkStatus | null>(null);
  processes = $state<ProcessesSnapshot | null>(null);
  logRevision = $state(0);
  #shown = $state(RESOURCES_PAGE);

  readonly pages = $derived([
    RESOURCES_PAGE,
    "PROCESSES",
    ...(this.network?.supported === true ? ["NETWORK"] : []),
    "SERVER_LOGS",
  ]);

  readonly page = $derived(Math.max(0, this.pages.indexOf(this.#shown)));

  select(index: number) {
    this.#shown = this.pages[index] ?? RESOURCES_PAGE;
  }

  #socket: { close: () => void } | null = null;
  #environment = new EnvironmentSlots(blank, () => this.#capture(), (snapshot) => this.#restore(snapshot));

  setActive(active: boolean) {
    if (!active) {
      this.#close();
      return;
    }
    if (!this.#socket || this.#environment.current !== backend.activeId) this.#open();
  }

  forget() {
    this.#environment.forget(backend.activeId);
  }

  reloadNetwork() {
    const at = this.#environment.current;
    void networkApi.status().then((status) => {
      if (at === this.#environment.current) this.network = status;
    });
  }

  #open() {
    this.#close();
    this.#environment.follow(backend.activeId);
    this.failed = false;
    this.reloadNetwork();
    this.#socket = systemApi.stream({
      onHistory: (samples, logs) => {
        if (!this.logs.length) this.logs = logs.slice(-LOG_CAP);
        if (!samples.length) return;
        if (this.cpuHistory.length) {
          this.#absorb(samples[samples.length - 1]);
          return;
        }
        for (const sample of samples) this.#absorb(sample);
      },
      onInfo: (snapshot) => {
        this.failed = false;
        this.#absorb(snapshot);
      },
      onLogs: (items) => {
        this.logs = [...this.logs, ...items].slice(-LOG_CAP);
        this.logRevision++;
      },
      onProcesses: (snapshot) => (this.processes = snapshot),
      onDrop: () => (this.failed = true),
    });
  }

  #capture(): MonitorSnapshot {
    return {
      info: this.info,
      gpu: this.gpu,
      network: this.network,
      logs: this.logs,
      processes: this.processes,
      cpuHistory: this.cpuHistory,
      gpuHistory: this.gpuHistory,
      memHistory: this.memHistory,
      vramHistory: this.vramHistory,
    };
  }

  #restore(snapshot: MonitorSnapshot) {
    this.info = snapshot.info;
    this.gpu = snapshot.gpu;
    this.network = snapshot.network;
    this.logs = snapshot.logs;
    this.processes = snapshot.processes;
    this.cpuHistory = snapshot.cpuHistory;
    this.gpuHistory = snapshot.gpuHistory;
    this.memHistory = snapshot.memHistory;
    this.vramHistory = snapshot.vramHistory;
  }

  #absorb(snapshot: SystemInfo) {
    this.info = snapshot;
    this.cpuHistory = append(this.cpuHistory, snapshot.cpuPercent);
    this.memHistory = append(this.memHistory, snapshot.memoryPercent);
    if (snapshot.gpu) {
      this.gpu = snapshot.gpu;
      this.gpuHistory = append(this.gpuHistory, snapshot.gpu.percent);
      this.vramHistory = append(this.vramHistory, snapshot.gpu.memPercent);
    }
  }

  #close() {
    this.#socket?.close();
    this.#socket = null;
  }
}

export const monitor = new Monitor();
