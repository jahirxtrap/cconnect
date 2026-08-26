import { backend, type Profile } from "./backend.svelte";
import { http, type HttpClient } from "./http";
import { ReconnectingSocket } from "./socket";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface DirListing {
  path: string;
  parent: string | null;
  roots: string[];
  entries: DirEntry[];
}

export interface DiskInfo {
  mount: string;
  used: number;
  total: number;
  percent: number;
}

export interface GpuInfo {
  name: string;
  percent: number;
  memUsed: number;
  memTotal: number;
  memPercent: number;
  temp: number | null;
}

export interface BatteryInfo {
  percent: number;
  plugged: boolean;
  secsLeft: number | null;
}

export interface SystemInfo {
  hostname: string;
  os: string;
  osId: string;
  arch: string;
  cpuName: string | null;
  uptime: number;
  cpuPercent: number;
  cpuCores: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryPercent: number;
  gpu: GpuInfo | null;
  battery: BatteryInfo | null;
  disks: DiskInfo[];
  netRx: number;
  netTx: number;
}

export interface LogEntry {
  ts: number;
  level: string;
  message: string;
}

export interface SystemHandlers {
  onInfo: (info: SystemInfo) => void;
  onLogs: (items: LogEntry[]) => void;
  onDrop: () => void;
}

type Wire = Record<string, any>;

const PING_SECONDS = 15;

const parseInfo = (raw: Wire): SystemInfo => ({
  hostname: raw.hostname ?? "",
  os: raw.os ?? "",
  osId: raw.os_id ?? "",
  arch: raw.arch ?? "",
  cpuName: raw.cpu_name ?? null,
  uptime: raw.uptime ?? 0,
  cpuPercent: raw.cpu?.percent ?? 0,
  cpuCores: raw.cpu?.cores ?? 0,
  memoryUsed: raw.memory?.used ?? 0,
  memoryTotal: raw.memory?.total ?? 0,
  memoryPercent: raw.memory?.percent ?? 0,
  gpu: raw.gpu
    ? {
        name: raw.gpu.name ?? "",
        percent: raw.gpu.percent ?? 0,
        memUsed: raw.gpu.mem_used ?? 0,
        memTotal: raw.gpu.mem_total ?? 0,
        memPercent: raw.gpu.mem_percent ?? 0,
        temp: raw.gpu.temp ?? null,
      }
    : null,
  battery: raw.battery
    ? {
        percent: raw.battery.percent ?? 0,
        plugged: raw.battery.plugged === true,
        secsLeft: raw.battery.secsleft ?? null,
      }
    : null,
  disks: (raw.disks ?? []).map((disk: Wire) => ({
    mount: disk.mount ?? "",
    used: disk.used ?? 0,
    total: disk.total ?? 0,
    percent: disk.percent ?? 0,
  })),
  netRx: raw.network?.rx ?? 0,
  netTx: raw.network?.tx ?? 0,
});

const parseLog = (raw: Wire): LogEntry => ({
  ts: raw.ts ?? 0,
  level: raw.level ?? "",
  message: raw.message ?? "",
});

export const createSystemApi = (client: HttpClient, profile: () => Profile) => ({
  async restart(): Promise<boolean> {
    return (await client.post("/system/restart")) !== null;
  },

  async dirs(path: string, files = false): Promise<DirListing | null> {
    const data = await client.get<Wire>(`/system/dirs?path=${encodeURIComponent(path)}&files=${files}`);
    if (!data) return null;
    return {
      path: typeof data.path === "string" ? data.path : "",
      parent: typeof data.parent === "string" ? data.parent : null,
      roots: Array.isArray(data.roots) ? (data.roots as string[]) : [],
      entries: (Array.isArray(data.entries) ? (data.entries as Wire[]) : []).map((item) => ({
        name: typeof item.name === "string" ? item.name : "",
        path: typeof item.path === "string" ? item.path : "",
        isDir: item.is_dir === true,
      })),
    };
  },

  stream(handlers: SystemHandlers): ReconnectingSocket {
    const socket = new ReconnectingSocket(
      "/system/ws",
      {
        onMessage: (message) => {
          if (message.type === "system") handlers.onInfo(parseInfo(message));
          else if (message.type === "logs") handlers.onLogs(((message.items as Wire[]) ?? []).map(parseLog));
        },
        onDrop: handlers.onDrop,
      },
      profile,
      PING_SECONDS,
    );
    socket.connect();
    return socket;
  },
});

export const systemApi = createSystemApi(http, () => backend.active);
