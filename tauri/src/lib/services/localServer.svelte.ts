import { settings } from "$lib/data/settings.svelte";
import { isTauri } from "$lib/platform";

export type LocalServerError = "bad_dir" | "no_python" | "launch_failed" | "crashed";

export interface LocalServerInfo {
  managed: boolean;
  ready: boolean;
  port: number;
  error: LocalServerError | null;
  errorDetail: string | null;
  publicUrl: string | null;
  token: string | null;
}

export type LocalServerState = "stopped" | "starting" | "running" | "manual" | "failed";

export const localServerStateOf = (info: LocalServerInfo): LocalServerState => {
  if (info.error !== null) return "failed";
  if (info.ready) return info.managed ? "running" : "manual";
  if (info.managed) return "starting";
  return "stopped";
};

const STATUS_EVENT = "local-server://status";

const empty: LocalServerInfo = {
  managed: false,
  ready: false,
  port: 0,
  error: null,
  errorDetail: null,
  publicUrl: null,
  token: null,
};

const config = () => ({
  dir: settings.localServerDir,
  python: settings.localServerPython,
  pythonPath: settings.localServerPythonPath,
  mode: settings.localServerMode,
  publicHost: settings.localServerPublicHost,
});

class LocalServer {
  info = $state<LocalServerInfo>(empty);

  start() {
    void this.#call("local_server_start", { config: config() });
  }

  stop() {
    void this.#call("local_server_stop", { config: config() });
  }

  restart() {
    void this.#call("local_server_restart", { config: config() });
  }

  async refresh() {
    await this.#call<LocalServerInfo>("local_server_status", { config: config() });
  }

  async watch() {
    if (!isTauri) return () => {};
    const { listen } = await import("@tauri-apps/api/event");
    await this.refresh();
    return listen<LocalServerInfo>(STATUS_EVENT, (event) => (this.info = event.payload));
  }

  async #call<T>(command: string, args: Record<string, unknown> = {}): Promise<T | null> {
    if (!isTauri) return null;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<T>(command, args);
      if (result && typeof result === "object" && "managed" in result) {
        this.info = result as unknown as LocalServerInfo;
      }
      return result;
    } catch {
      return null;
    }
  }
}

export const localServer = new LocalServer();
