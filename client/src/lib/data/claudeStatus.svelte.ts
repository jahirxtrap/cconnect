import { untrack } from "svelte";

import { accountsStore } from "$lib/data/accountsStore.svelte";
import { loads } from "$lib/data/inflight";
import { type AccountsSnapshot } from "$lib/services/accountsApi";
import { backend } from "$lib/services/backend.svelte";
import {
  claudeApi,
  type Extensions,
  type McpServer,
  type ServiceStatus,
  type Skill,
  type Usage,
} from "$lib/services/claudeApi";
import { cliApi, type CliInfo, type SdkInfo } from "$lib/services/cliApi";

interface ClaudeSnapshot {
  cli: CliInfo | null;
  sdk: SdkInfo | null;
  userPrompt: string | null;
  extensions: Extensions | null;
  skills: Skill[] | null;
  mcpServers: McpServer[] | null;
  service: ServiceStatus | null;
  accounts: AccountsSnapshot | null;
  usage: Usage | null;
}

const blank: ClaudeSnapshot = {
  cli: null,
  sdk: null,
  userPrompt: null,
  extensions: null,
  skills: null,
  mcpServers: null,
  service: null,
  accounts: null,
  usage: null,
};

class ClaudeStatus {
  cli = $state<CliInfo | null>(null);
  sdk = $state<SdkInfo | null>(null);
  userPrompt = $state<string | null>(null);
  extensions = $state<Extensions | null>(null);
  skills = $state<Skill[] | null>(null);
  mcpServers = $state<McpServer[] | null>(null);
  service = $state<ServiceStatus | null>(null);
  accounts = $state<AccountsSnapshot | null>(null);
  usage = $state<Usage | null>(null);
  loading = $state(true);
  usageLoading = $state(true);

  #slots = new Map<string, ClaudeSnapshot>();
  #environmentId: string | null = null;
  #usageRun: Promise<void> | null = null;
  #usageAgain = false;

  loadCli() {
    return loads.track(this.#loadCli());
  }

  loadExtensions() {
    return loads.track(this.#loadExtensions());
  }

  loadService(force = false) {
    return loads.track(this.#loadService(force));
  }

  loadUsage(force = false) {
    return loads.track(this.#loadUsage(force));
  }

  async #loadCli() {
    const at = this.#sync();
    if (!backend.configured) {
      this.cli = null;
      this.sdk = null;
      this.userPrompt = null;
      return;
    }
    const cli = await cliApi.status();
    const sdk = await cliApi.sdkStatus();
    const userPrompt = await claudeApi.userPrompt();
    if (at !== backend.activeId) return;
    this.cli = cli;
    this.sdk = sdk;
    this.userPrompt = userPrompt;
  }

  async #loadExtensions() {
    const at = this.#sync();
    if (!backend.configured) {
      this.extensions = null;
      this.skills = null;
      this.mcpServers = null;
      return;
    }
    const [extensions, skills, mcpServers] = await Promise.all([
      claudeApi.extensions(),
      claudeApi.skills(),
      claudeApi.mcp(),
    ]);
    if (at !== backend.activeId) return;
    this.extensions = extensions;
    this.skills = skills;
    this.mcpServers = mcpServers;
  }

  async #loadService(force: boolean) {
    const at = this.#sync();
    this.loading = untrack(() => this.service) === null;
    const value = backend.configured ? await claudeApi.status(force) : null;
    if (at !== backend.activeId) return;
    this.service = value;
    this.loading = false;
  }

  async #loadUsage(force: boolean): Promise<void> {
    if (this.#usageRun) {
      this.#usageAgain ||= force;
      return this.#usageRun;
    }
    this.#usageRun = this.#runUsage(force);
    await this.#usageRun;
    this.#usageRun = null;
    if (!this.#usageAgain) return;
    this.#usageAgain = false;
    await this.#loadUsage(true);
  }

  async #runUsage(force: boolean) {
    const at = this.#sync();
    this.usageLoading = untrack(() => this.usage) === null;
    await accountsStore.load();
    const accounts = accountsStore.snapshot;
    const usage = await claudeApi.usage(accounts?.default ?? null, force);
    if (at !== backend.activeId) return;
    this.accounts = accounts;
    this.usage = usage;
    this.usageLoading = false;
  }

  forget() {
    const current = backend.activeId;
    if (current !== null) this.#slots.delete(current);
    this.#environmentId = current;
    this.#restore(blank);
  }

  ensure() {
    this.#sync();
    untrack(() => {
      if (this.cli === null) void this.loadCli();
      if (this.extensions === null) void this.loadExtensions();
      if (this.service === null) void this.loadService();
    });
  }

  #sync(): string | null {
    const next = backend.activeId;
    if (next === this.#environmentId) return next;
    untrack(() => {
      if (this.#environmentId !== null) this.#slots.set(this.#environmentId, this.#capture());
      this.#environmentId = next;
      this.#restore((next === null ? undefined : this.#slots.get(next)) ?? blank);
    });
    return next;
  }

  #capture(): ClaudeSnapshot {
    return {
      cli: this.cli,
      sdk: this.sdk,
      userPrompt: this.userPrompt,
      extensions: this.extensions,
      skills: this.skills,
      mcpServers: this.mcpServers,
      service: this.service,
      accounts: this.accounts,
      usage: this.usage,
    };
  }

  #restore(snapshot: ClaudeSnapshot) {
    this.cli = snapshot.cli;
    this.sdk = snapshot.sdk;
    this.userPrompt = snapshot.userPrompt;
    this.extensions = snapshot.extensions;
    this.skills = snapshot.skills;
    this.mcpServers = snapshot.mcpServers;
    this.service = snapshot.service;
    this.accounts = snapshot.accounts;
    this.usage = snapshot.usage;
  }
}

export const claudeStatus = new ClaudeStatus();
