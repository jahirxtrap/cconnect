import { APP_VERSION, SUPPORTED_SERVER } from "./build";
import type { ConnectionState } from "./chatModels";
import { chatListFor } from "./chatList.svelte";
import { compareVersions, satisfies } from "./compat";
import { settings } from "./settings.svelte";
import { isTauri } from "$lib/platform";
import { onWake } from "$lib/platform/wake";
import { backend, tokenOf } from "$lib/services/backend.svelte";
import { capabilitiesApi, type VersionInfo } from "$lib/services/capabilitiesApi";
import { latestRelease, type Release } from "$lib/services/githubApi";

const POLL_MS = 30_000;

export type CompatNotice =
  | "app_outdated"
  | "server_outdated"
  | "cli_outdated"
  | "unauthorized"
  | "token_rejected"
  | "update_available";

class ServerStatus {
  reachable = $state(false);
  checking = $state(true);
  answered = $state(false);
  version = $state<VersionInfo | null>(null);
  release = $state<Release | null>(null);
  updateAvailable = $state(false);
  releaseChecked = $state(false);
  releaseChecking = $state(false);
  releaseFailed = $state(false);

  #releaseRequested = false;
  #request = 0;

  readonly unauthorized = $derived(this.reachable && this.version?.gated === true && !this.version.authorized);

  readonly online = $derived(this.reachable && !this.unauthorized);

  readonly link = $derived<ConnectionState>(
    this.online ? "connected" : this.checking || !this.answered ? "connecting" : "disconnected",
  );

  readonly unavailable = $derived(this.link === "disconnected");

  readonly appOutdated = $derived(!satisfies(APP_VERSION, this.version?.supportedApp));
  readonly serverOutdated = $derived(!satisfies(this.version?.serverVersion, SUPPORTED_SERVER));
  readonly cliOutdated = $derived(
    !!this.version?.cliVersion && !satisfies(this.version.cliVersion, this.version.supportedCli),
  );
  readonly releaseNotice = $derived(
    isTauri && this.updateAvailable && !!this.release && this.release.tag !== settings.skippedRelease,
  );

  readonly notices = $derived.by<CompatNotice[]>(() => {
    if (!this.reachable) return [];
    if (this.unauthorized) return [tokenOf(backend.active) ? "token_rejected" : "unauthorized"];
    const notices: CompatNotice[] = [];
    if (this.appOutdated) notices.push("app_outdated");
    if (this.serverOutdated) notices.push("server_outdated");
    if (this.cliOutdated) notices.push("cli_outdated");
    if (this.releaseNotice) notices.push("update_available");
    return notices;
  });

  skipRelease() {
    if (this.release) settings.skippedRelease = this.release.tag;
  }

  start() {
    void this.checkRelease();
    $effect(() => {
      void backend.baseUrl;
      this.checking = true;
      this.answered = false;
      void this.refresh();
      const timer = setInterval(() => void this.refresh(), POLL_MS);
      const stopWake = onWake(() => {
        this.checking = true;
        void this.refresh();
      });
      return () => {
        clearInterval(timer);
        stopWake();
      };
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
        if (opened) this.reachable = false;
      });
    });
  }

  async checkRelease(force = false) {
    if (this.#releaseRequested && !force) return;
    this.#releaseRequested = true;
    this.releaseChecking = true;
    const latest = await latestRelease();
    const found = latest ?? this.release;
    this.release = found;
    this.updateAvailable = !!found && compareVersions(found.tag.replace(/^v/, ""), APP_VERSION) > 0;
    this.releaseFailed = latest === null;
    this.releaseChecked = true;
    this.releaseChecking = false;
  }

  async refresh() {
    const request = ++this.#request;
    const version = await capabilitiesApi.versionInfo();
    if (request !== this.#request) return;
    this.version = version;
    this.reachable = version !== null;
    this.checking = false;
    this.answered = true;
  }
}

export const serverStatus = new ServerStatus();
