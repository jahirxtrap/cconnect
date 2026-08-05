import { backend, type Profile } from "./backend.svelte";
import { http, type HttpClient } from "./http";
import { ReconnectingSocket } from "./socket";

export interface NetworkInterface {
  name: string;
  description: string | null;
  kind: string;
  up: boolean;
  linkSpeed: string | null;
  network: string | null;
  internet: boolean;
}

export interface WifiNetwork {
  ssid: string;
  signal: number | null;
  security: string | null;
  active: boolean;
  known: boolean;
}

export interface NetworkStatus {
  supported: boolean;
  wiredControl: boolean;
  needsPassword: boolean;
  speedtest: boolean;
  connectivity: string;
  wifiRadio: boolean | null;
  wifiSsid: string | null;
  interfaces: NetworkInterface[];
}

export interface NetworkJob {
  id: string;
  status: string;
  message: string | null;
  recovered: boolean | null;
}

export interface SpeedtestResult {
  download: number | null;
  upload: number | null;
  ping: number | null;
  jitter: number | null;
  server: string | null;
  isp: string | null;
}

export interface SpeedtestHandlers {
  onProgress: (stage: string, progress: number) => void;
  onResult: (result: SpeedtestResult) => void;
  onFailed: (message: string) => void;
}

type Wire = Record<string, any>;

const parseInterface = (raw: Wire): NetworkInterface => ({
  name: raw.name ?? "",
  description: raw.description ?? null,
  kind: raw.kind ?? "other",
  up: raw.up === true,
  linkSpeed: raw.link_speed ?? null,
  network: raw.network ?? null,
  internet: raw.internet === true,
});

const parseNetwork = (raw: Wire): WifiNetwork => ({
  ssid: raw.ssid ?? "",
  signal: raw.signal ?? null,
  security: raw.security ?? null,
  active: raw.active === true,
  known: raw.known === true,
});

const parseJob = (raw: Wire): NetworkJob => ({
  id: raw.id ?? "",
  status: raw.status ?? "",
  message: raw.message ?? null,
  recovered: raw.recovered ?? null,
});

export const createNetworkApi = (client: HttpClient, profile: () => Profile) => ({
  async status(): Promise<NetworkStatus | null> {
    const data = await client.get<Wire>("/network");
    if (!data) return null;
    if (data.supported !== true) {
      return {
        supported: false,
        wiredControl: false,
        needsPassword: false,
        speedtest: false,
        connectivity: "unknown",
        wifiRadio: null,
        wifiSsid: null,
        interfaces: [],
      };
    }
    return {
      supported: true,
      wiredControl: data.wired_control === true,
      needsPassword: data.needs_password === true,
      speedtest: data.speedtest === true,
      connectivity: data.connectivity ?? "unknown",
      wifiRadio: data.wifi_radio ?? null,
      wifiSsid: data.wifi_ssid ?? null,
      interfaces: (data.interfaces ?? []).map(parseInterface),
    };
  },

  async scan(): Promise<WifiNetwork[]> {
    const data = await client.get<Wire>("/network/wifi");
    return (data?.networks ?? []).map(parseNetwork);
  },

  async connect(ssid: string, password: string | null): Promise<NetworkJob | null> {
    const data = await client.post<Wire>("/network/wifi/connect", {
      ssid,
      ...(password === null ? {} : { password }),
    });
    return data && parseJob(data);
  },

  async setRadio(enabled: boolean): Promise<NetworkJob | null> {
    const data = await client.post<Wire>("/network/wifi/radio", { enabled });
    return data && parseJob(data);
  },

  async setInterface(name: string, enabled: boolean): Promise<NetworkJob | null> {
    const data = await client.post<Wire>("/network/interface", { name, enabled });
    return data && parseJob(data);
  },

  async authorize(password: string): Promise<boolean> {
    return (await client.post("/network/auth", { password })) !== null;
  },

  async job(id: string): Promise<NetworkJob | null> {
    const data = await client.get<Wire>(`/network/job/${id}`);
    return data && parseJob(data);
  },

  speedtest(handlers: SpeedtestHandlers): ReconnectingSocket {
    const socket = new ReconnectingSocket(
      "/network/speedtest/ws",
      {
        onMessage: (message) => {
          if (message.type === "progress") {
            handlers.onProgress((message.stage as string) ?? "", (message.progress as number) ?? 0);
          } else if (message.type === "result") {
            handlers.onResult({
              download: (message.download as number) ?? null,
              upload: (message.upload as number) ?? null,
              ping: (message.ping as number) ?? null,
              jitter: (message.jitter as number) ?? null,
              server: (message.server as string) ?? null,
              isp: (message.isp as string) ?? null,
            });
          } else if (message.type === "error") {
            handlers.onFailed((message.message as string) ?? "");
          }
        },
      },
      profile,
    );
    socket.connect();
    return socket;
  },
});

export const networkApi = createNetworkApi(http, () => backend.active);
