import { settings } from "$lib/data/settings.svelte";
import { backend } from "./backend.svelte";
import { isTauri } from "$lib/platform";

export type LocalServerError = "bad_dir" | "no_python" | "launch_failed" | "crashed";

export interface LocalServerInfo {
  managed: boolean;
  ready: boolean;
  error: LocalServerError | null;
  errorDetail: string | null;
  publicUrl: string | null;
  token: string | null;
}

export type LocalServerState = "stopped" | "starting" | "running" | "external" | "failed";

const DEFAULT_PORT = 8723;
const STATUS_EVENT = "local-server://status";

const empty: LocalServerInfo = {
  managed: false,
  ready: false,
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
  probePort: backend.active?.port ?? DEFAULT_PORT,
  publicHost: settings.localServerPublicHost,
});

class LocalServer {
  info = $state<LocalServerInfo>(empty);

  readonly state = $derived.by<LocalServerState>(() => {
    if (this.info.error !== null) return "failed";
    if (this.info.ready) return this.info.managed ? "running" : "external";
    return this.info.managed ? "starting" : "stopped";
  });

  start() {
    void this.#call("local_server_start", { config: config() });
  }

  stop() {
    void this.#call("local_server_stop");
  }

  restart() {
    void this.#call("local_server_stop").then(() => this.start());
  }

  async watch() {
    if (!isTauri) return () => {};
    const { listen } = await import("@tauri-apps/api/event");
    this.info = (await this.#call<LocalServerInfo>("local_server_status")) ?? empty;
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
