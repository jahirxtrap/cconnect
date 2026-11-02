import { securityKeys } from "$lib/data/securityKeys.svelte";
import { settings } from "$lib/data/settings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { isTauri } from "$lib/platform";
import { backend, blankEnvironment, tokenOf, type Profile } from "./backend.svelte";

export type LocalServerError =
  | "bad_dir"
  | "no_python"
  | "no_command"
  | "launch_failed"
  | "crashed"
  | "port_busy"
  | "mode_mismatch";

export interface LocalServerInfo {
  managed: boolean;
  ready: boolean;
  port: number;
  error: LocalServerError | null;
  errorDetail: string | null;
  publicUrl: string | null;
  token: string | null;
  securityKey: string | null;
}

export type LocalServerState = "stopped" | "starting" | "running" | "manual" | "failed";

export const localServerStateOf = (info: LocalServerInfo): LocalServerState => {
  if (info.error !== null) return "failed";
  if (info.ready) return info.managed ? "running" : "manual";
  if (info.managed) return "starting";
  return "stopped";
};

const STATUS_EVENT = "local-server://status";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

export const isLocalProfile = (profile: Profile, port: number) =>
  !!profile && LOCAL_HOSTS.includes(profile.host.toLowerCase()) && profile.port === port;

const empty: LocalServerInfo = {
  managed: false,
  ready: false,
  port: 0,
  error: null,
  errorDetail: null,
  publicUrl: null,
  token: null,
  securityKey: null,
};

const config = () => ({
  dir: settings.localServerDir,
  source: settings.localServerSource,
  commandPath: settings.localServerCommandPath,
  python: settings.localServerPython,
  pythonPath: settings.localServerPythonPath,
  mode: settings.localServerMode,
  publicHost: settings.localServerPublicHost,
});

class LocalServer {
  info = $state<LocalServerInfo>(empty);

  readonly native = $derived(settings.localServerSource === "native");

  update(): Promise<string | null> {
    return this.#call<string>("local_server_update", { config: config() });
  }

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
    return listen<LocalServerInfo>(STATUS_EVENT, (event) => this.#apply(event.payload));
  }

  #apply(info: LocalServerInfo) {
    const started = localServerStateOf(info) === "running" && localServerStateOf(this.info) !== "running";
    this.info = info;
    if (started) this.#adopt(info);
  }

  #adopt({ port, token, securityKey }: LocalServerInfo) {
    const profile = backend.environments.find((item) => isLocalProfile(item, port)) ?? this.#environment(port);
    if (token && tokenOf(profile) !== token) backend.update(profile.id, { authKind: "bearer", authToken: token });
    if (securityKey && securityKeys.keyFor(profile) !== securityKey) securityKeys.setFor(profile, securityKey);
  }

  #environment(port: number) {
    const profile = { ...blankEnvironment(), name: t("LOCAL_SERVER"), host: LOCAL_HOSTS[0], port };
    backend.save([...backend.environments, profile]);
    if (backend.environments.length === 1) backend.select(profile.id);
    return profile;
  }

  async #call<T>(command: string, args: Record<string, unknown> = {}): Promise<T | null> {
    if (!isTauri) return null;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<T>(command, args);
      if (result && typeof result === "object" && "managed" in result) {
        this.#apply(result as unknown as LocalServerInfo);
      }
      return result;
    } catch {
      return null;
    }
  }
}

export const localServer = new LocalServer();
