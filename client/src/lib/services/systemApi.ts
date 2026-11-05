import { securityKeys } from "$lib/data/securityKeys.svelte";
import { backend, type Profile } from "./backend.svelte";
import { createHttp, http, type HttpClient, type HttpResult } from "./http";
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

export const PROCESS_KINDS = ["server", "chat", "agent", "terminal", "browser", "other"] as const;

export type ProcessKind = (typeof PROCESS_KINDS)[number];

export interface ProcessUsage {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  started: number;
}

export type ProcessRole = "quick_chat" | null;

export interface ProcessPart extends ProcessUsage {
  detail: string | null;
  count: number;
  role: ProcessRole;
}

export type ProcessStop = "open" | "key" | null;

export interface ProcessEntry extends ProcessUsage {
  kind: ProcessKind;
  title: string | null;
  detail: string | null;
  projectKey: string | null;
  activity: string | null;
  stop: ProcessStop;
  processes: ProcessUsage[];
  parts: ProcessPart[];
}

export interface ProcessesSnapshot {
  items: ProcessEntry[];
  cpu: number;
  memory: number;
}

export interface ServerUpdate {
  ok: boolean;
  message: string;
  source: "package" | "checkout";
  latest: string;
  tracked: boolean;
  changed: boolean;
  revision: string;
  behind: number;
  ahead: number;
  dirty: boolean;
  reloads: boolean;
}

export interface SystemHandlers {
  onHistory: (samples: SystemInfo[], logs: LogEntry[]) => void;
  onInfo: (info: SystemInfo) => void;
  onLogs: (items: LogEntry[]) => void;
  onProcesses: (snapshot: ProcessesSnapshot) => void;
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

const parseUsage = (raw: Wire): ProcessUsage => ({
  pid: raw.pid ?? 0,
  name: raw.name ?? "",
  cpu: raw.cpu ?? 0,
  memory: raw.memory ?? 0,
  started: raw.started ?? 0,
});

const parsePart = (raw: Wire): ProcessPart => ({
  ...parseUsage(raw),
  detail: raw.detail ?? null,
  count: raw.count ?? 1,
  role: raw.role === "quick_chat" ? raw.role : null,
});

const parseProcess = (raw: Wire): ProcessEntry => ({
  ...parseUsage(raw),
  kind: PROCESS_KINDS.includes(raw.kind) ? raw.kind : "other",
  title: raw.title ?? null,
  detail: raw.detail ?? null,
  projectKey: raw.project_key ?? null,
  activity: raw.activity ?? null,
  stop: raw.stop === "open" || raw.stop === "key" ? raw.stop : null,
  processes: ((raw.processes as Wire[]) ?? []).map(parseUsage),
  parts: ((raw.parts as Wire[]) ?? []).map(parsePart),
});

const parseProcesses = (raw: Wire): ProcessesSnapshot => ({
  items: ((raw.items as Wire[]) ?? []).map(parseProcess),
  cpu: raw.total?.cpu ?? 0,
  memory: raw.total?.memory ?? 0,
});

const parseUpdate = (raw: Wire): ServerUpdate => ({
  ok: raw.ok !== false,
  message: raw.message ?? "",
  source: raw.source === "package" ? "package" : "checkout",
  latest: raw.latest ?? "",
  tracked: raw.tracked === true,
  changed: raw.changed === true,
  revision: raw.revision ?? "",
  behind: raw.behind ?? 0,
  ahead: raw.ahead ?? 0,
  dirty: raw.dirty === true,
  reloads: raw.reloads === true,
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

  stopProcess(pid: number, key: string): Promise<HttpResult<Wire>> {
    return createHttp(profile, () => securityKeys.headers(key)).call<Wire>("POST", `/system/processes/${pid}/stop`, undefined, {});
  },

  async checkUpdate(): Promise<ServerUpdate | null> {
    const data = await client.post<Wire>("/system/update/check");
    return data && parseUpdate(data);
  },

  async update(): Promise<ServerUpdate | null> {
    const data = await client.post<Wire>("/system/update");
    return data && parseUpdate(data);
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
          else if (message.type === "processes") handlers.onProcesses(parseProcesses(message));
          else if (message.type === "history") {
            handlers.onHistory(
              ((message.items as Wire[]) ?? []).map(parseInfo),
              ((message.logs as Wire[]) ?? []).map(parseLog),
            );
          }
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
