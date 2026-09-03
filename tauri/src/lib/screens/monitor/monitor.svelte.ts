import { serverStatus } from "$lib/data/serverStatus.svelte";
import { backend } from "$lib/services/backend.svelte";
import { networkApi, type NetworkStatus } from "$lib/services/networkApi";
import { systemApi, type GpuInfo, type LogEntry, type SystemInfo } from "$lib/services/systemApi";

const HISTORY_CAP = 90;
const LOG_CAP = 300;

const append = (history: number[], value: number) => [...history, value].slice(-HISTORY_CAP);

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
  logRevision = $state(0);

  #socket: { close: () => void } | null = null;
  #environmentId: string | null = null;

  setActive(active: boolean) {
    if (!active) {
      this.#close();
      return;
    }
    if (!this.#socket || this.#environmentId !== backend.activeId) this.#open();
  }

  reloadNetwork() {
    void networkApi.status().then((status) => (this.network = status));
  }

  #open() {
    this.#close();
    this.#environmentId = backend.activeId;
    this.info = null;
    this.gpu = null;
    this.failed = false;
    this.cpuHistory = [];
    this.gpuHistory = [];
    this.memHistory = [];
    this.vramHistory = [];
    this.logs = [];
    this.reloadNetwork();
    this.#socket = systemApi.stream({
      onInfo: (snapshot) => {
        this.failed = false;
        this.info = snapshot;
        this.cpuHistory = append(this.cpuHistory, snapshot.cpuPercent);
        this.memHistory = append(this.memHistory, snapshot.memoryPercent);
        if (snapshot.gpu) {
          this.gpu = snapshot.gpu;
          this.gpuHistory = append(this.gpuHistory, snapshot.gpu.percent);
          this.vramHistory = append(this.vramHistory, snapshot.gpu.memPercent);
        }
      },
      onLogs: (items) => {
        this.logs = [...this.logs, ...items].slice(-LOG_CAP);
        this.logRevision++;
      },
      onDrop: () => (this.failed = true),
    });
  }

  #close() {
    this.#socket?.close();
    this.#socket = null;
  }
}

export const monitor = new Monitor();
