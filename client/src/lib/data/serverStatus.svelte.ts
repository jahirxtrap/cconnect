import { APP_VERSION, SUPPORTED_SERVER } from "./build";
import type { ConnectionState } from "./chatModels";
import { chatListFor } from "./chatList.svelte";
import { compareVersions, satisfies } from "./compat";
import { settings } from "./settings.svelte";
import { isTauri } from "$lib/platform";
import { onWake } from "$lib/platform/wake";
import { backend, profileKey, tokenOf } from "$lib/services/backend.svelte";
import { capabilitiesApi, type VersionInfo } from "$lib/services/capabilitiesApi";
import { latestRelease, type Release } from "$lib/services/githubApi";

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
  #listed = $state(false);
  #onlineWaiters: (() => void)[] = [];
  #offlineWaiters: (() => void)[] = [];

  readonly unauthorized = $derived(this.reachable && this.version?.gated === true && !this.version.authorized);

  readonly online = $derived((this.reachable || this.#listed) && !this.unauthorized);

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
    const release: CompatNotice[] = this.releaseNotice ? ["update_available"] : [];
    if (!this.reachable) return release;
    if (this.unauthorized) return [tokenOf(backend.active) ? "token_rejected" : "unauthorized", ...release];
    const notices: CompatNotice[] = [];
    if (this.appOutdated) notices.push("app_outdated");
    if (this.serverOutdated) notices.push("server_outdated");
    if (this.cliOutdated) notices.push("cli_outdated");
    return [...notices, ...release];
  });

  skipRelease() {
    if (this.release) settings.skippedRelease = this.release.tag;
  }

  whenOnline(): Promise<void> {
    if (this.online) return Promise.resolve();
    return new Promise((resolve) => this.#onlineWaiters.push(resolve));
  }

  whenOffline(): Promise<void> {
    if (!this.online) return Promise.resolve();
    return new Promise((resolve) => this.#offlineWaiters.push(resolve));
  }

  start() {
    void this.checkRelease();
    $effect(() => {
      const waiters = this.online ? this.#onlineWaiters : this.#offlineWaiters;
      for (const resolve of waiters.splice(0)) resolve();
    });
    $effect(() => {
      void profileKey(backend.active);
      this.checking = true;
      this.answered = false;
      void this.refresh();
      return onWake(() => {
        this.checking = true;
        void this.refresh();
      });
    });

    $effect(() => {
      const list = chatListFor(backend.active);
      this.#listed = false;
      if (!list) return;
      let opened = false;
      let lost = false;
      $effect(() => {
        this.#listed = list.connected;
        if (list.connected) {
          opened = true;
          lost = false;
          void this.refresh();
          return;
        }
        void list.drops;
        if (!opened) return;
        if (!lost) {
          lost = true;
          this.reachable = false;
          this.checking = true;
        }
        void this.refresh();
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
    const profile = backend.active;
    const version = await capabilitiesApi.versionInfo();
    if (version) backend.rememberScheme(profile, version.sharedScheme);
    if (request !== this.#request) return;
    this.version = version;
    this.reachable = version !== null;
    this.checking = false;
    this.answered = true;
  }
}

export const serverStatus = new ServerStatus();
