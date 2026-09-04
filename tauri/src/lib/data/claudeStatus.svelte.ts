import { backend } from "$lib/services/backend.svelte";
import { claudeApi, type Extensions, type McpServer, type ServiceStatus, type Skill } from "$lib/services/claudeApi";
import { cliApi, type CliInfo, type SdkInfo } from "$lib/services/cliApi";

class ClaudeStatus {
  cli = $state<CliInfo | null>(null);
  sdk = $state<SdkInfo | null>(null);
  userPrompt = $state<string | null>(null);
  extensions = $state<Extensions | null>(null);
  skills = $state<Skill[] | null>(null);
  mcpServers = $state<McpServer[] | null>(null);
  service = $state<ServiceStatus | null>(null);
  loading = $state(true);

  async loadCli() {
    if (!backend.configured) {
      this.cli = null;
      this.sdk = null;
      this.userPrompt = null;
      return;
    }
    this.cli = await cliApi.status();
    this.sdk = await cliApi.sdkStatus();
    this.userPrompt = await claudeApi.userPrompt();
  }

  async loadExtensions() {
    if (!backend.configured) {
      this.extensions = null;
      this.skills = null;
      this.mcpServers = null;
      return;
    }
    await Promise.allSettled([
      claudeApi.extensions().then((value) => (this.extensions = value)),
      claudeApi.skills().then((value) => (this.skills = value)),
      claudeApi.mcp().then((value) => (this.mcpServers = value)),
    ]);
  }

  async loadService() {
    this.loading = true;
    this.service = backend.configured ? await claudeApi.status() : null;
    this.loading = false;
  }

  ensure() {
    if (this.cli === null) void this.loadCli();
    if (this.extensions === null) void this.loadExtensions();
    if (this.service === null) void this.loadService();
  }
}

export const claudeStatus = new ClaudeStatus();
