import { APP_VERSION, SUPPORTED_SERVER } from "./build";
import { chatListFor } from "./chatList.svelte";
import { compareVersions, satisfies } from "./compat";
import { backend } from "$lib/services/backend.svelte";
import { capabilitiesApi, type VersionInfo } from "$lib/services/capabilitiesApi";
import { latestRelease, type Release } from "$lib/services/githubApi";

const POLL_MS = 30_000;

export type CompatNotice = "app_outdated" | "server_outdated" | "cli_outdated";

class ServerStatus {
  online = $state(false);
  checking = $state(true);
  version = $state<VersionInfo | null>(null);
  release = $state<Release | null>(null);
  updateAvailable = $state(false);
  releaseChecked = $state(false);

  #releaseRequested = false;

  readonly unavailable = $derived(!this.checking && !this.online);

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
    void this.checkRelease();
    $effect(() => {
      void backend.baseUrl;
      this.checking = true;
      void this.refresh();
      const timer = setInterval(() => void this.refresh(), POLL_MS);
      return () => clearInterval(timer);
    });

    $effect(() => {
      const list = chatListFor(backend.active);
      if (!list) return;
      let opened = false;
      $effect(() => {
        if (list.connected) {
          opened = true;
          void this.refresh();
          return;
        }
        if (opened) this.online = false;
      });
    });
  }

  async checkRelease(force = false) {
    if (this.#releaseRequested && !force) return;
    this.#releaseRequested = true;
    const found = (await latestRelease()) ?? this.release;
    this.release = found;
    this.updateAvailable = !!found && compareVersions(found.tag.replace(/^v/, ""), APP_VERSION) > 0;
    this.releaseChecked = true;
  }

  async refresh() {
    const version = await capabilitiesApi.versionInfo();
    this.version = version;
    this.online = version !== null;
    this.checking = false;
  }
}

export const serverStatus = new ServerStatus();
