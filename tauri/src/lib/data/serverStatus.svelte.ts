import { APP_VERSION, SUPPORTED_SERVER } from "./build";
import { satisfies } from "./compat";
import { backend } from "$lib/services/backend.svelte";
import { capabilitiesApi, type VersionInfo } from "$lib/services/capabilitiesApi";

const POLL_MS = 30_000;

export type CompatNotice = "app_outdated" | "server_outdated" | "cli_outdated";

class ServerStatus {
  online = $state(false);
  checking = $state(true);
  version = $state<VersionInfo | null>(null);

  readonly appOutdated = $derived(!satisfies(APP_VERSION, this.version?.supportedApp));
  readonly serverOutdated = $derived(!satisfies(this.version?.serverVersion, SUPPORTED_SERVER));
  readonly cliOutdated = $derived(
    !!this.version?.cliVersion && !satisfies(this.version.cliVersion, this.version.supportedCli),
  );

  readonly notices = $derived.by<CompatNotice[]>(() => {
    if (!this.online) return [];
    const notices: CompatNotice[] = [];
    if (this.appOutdated) notices.push("app_outdated");
    if (this.serverOutdated) notices.push("server_outdated");
    if (this.cliOutdated) notices.push("cli_outdated");
    return notices;
  });

  start() {
    $effect(() => {
      void backend.baseUrl;
      this.checking = true;
      void this.refresh();
      const timer = setInterval(() => void this.refresh(), POLL_MS);
      return () => clearInterval(timer);
    });
  }

  async refresh() {
    const version = await capabilitiesApi.versionInfo();
    this.version = version;
    this.online = version !== null;
    this.checking = false;
  }
}

export const serverStatus = new ServerStatus();
