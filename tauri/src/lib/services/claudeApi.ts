import { backend, baseUrlOf, type Profile } from "./backend.svelte";
import { http, type HttpClient } from "./http";

export interface Plugin {
  name: string;
  marketplace: string | null;
  version: string | null;
  scope: string | null;
  enabled: boolean;
  description: string | null;
}

export interface Marketplace {
  name: string;
  repo: string | null;
}

export interface Extensions {
  plugins: Plugin[];
  marketplaces: Marketplace[];
}

export interface Skill {
  name: string;
  id: string;
  description: string | null;
  plugin: string | null;
  pluginName: string | null;
  enabled: boolean;
}

export interface McpServer {
  name: string;
  type: string | null;
  detail: string | null;
  enabled: boolean;
}

export interface CatalogPlugin {
  name: string;
  description: string | null;
  version: string | null;
  installed: boolean;
}

export interface Memory {
  scope: string;
  name: string;
  description: string | null;
}

export interface Memories {
  global: Memory[];
  project: Memory[];
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface UsageWindow {
  id: string;
  percent: number;
  resetsAt: string | null;
}

export interface Usage {
  plan: string | null;
  windows: UsageWindow[];
  error: string | null;
}

export interface ServiceComponent {
  name: string;
  status: string;
}

export interface ServiceIncident {
  name: string;
  impact: string;
  status: string;
  latest: string | null;
  updatedAt: string | null;
  shortlink: string | null;
}

export interface ServiceStatus {
  indicator: string;
  description: string;
  components: ServiceComponent[];
  incidents: ServiceIncident[];
  error: string | null;
}

type Wire = Record<string, any>;

const toAction = (data: Wire | null): ActionResult => ({
  ok: data?.ok === true,
  message: data?.message ?? "",
});

export const createClaudeApi = (client: HttpClient, profile: () => Profile) => ({
  async usage(account: string | null = null): Promise<Usage | null> {
    const data = await client.get<Wire>("/claude/usage", account ? { account } : undefined);
    if (!data) return null;
    return {
      plan: data.plan ?? null,
      windows: (data.windows ?? []).map((window: Wire) => ({
        id: window.id ?? "",
        percent: window.percent ?? 0,
        resetsAt: window.resets_at ?? null,
      })),
      error: data.error ?? null,
    };
  },

  async status(): Promise<ServiceStatus | null> {
    const data = await client.get<Wire>("/claude/status");
    if (!data) return null;
    return {
      indicator: data.indicator ?? "none",
      description: data.description ?? "",
      components: (data.components ?? [])
        .filter((item: Wire) => item.name)
        .map((item: Wire) => ({ name: item.name, status: item.status ?? "operational" })),
      incidents: (data.incidents ?? [])
        .filter((item: Wire) => item.name)
        .map((item: Wire) => ({
          name: item.name,
          impact: item.impact ?? "none",
          status: item.status ?? "",
          latest: item.latest ?? null,
          updatedAt: item.updated_at ?? null,
          shortlink: item.shortlink ?? null,
        })),
      error: data.error ?? null,
    };
  },

  async userPrompt(): Promise<string | null> {
    const data = await client.get<Wire>("/claude/prompt");
    return data?.text ?? null;
  },

  async setUserPrompt(text: string): Promise<boolean> {
    return (await client.put("/claude/prompt", { text })) !== null;
  },

  async projectPrompt(project: string): Promise<string | null> {
    const data = await client.get<Wire>("/claude/project-prompt", { project });
    return data?.text ?? null;
  },

  async setProjectPrompt(project: string, text: string): Promise<boolean> {
    return (await client.put("/claude/project-prompt", { project, text })) !== null;
  },

  async extensions(): Promise<Extensions | null> {
    const data = await client.get<Wire>("/claude/plugins");
    if (!data) return null;
    return {
      plugins: (data.plugins ?? [])
        .filter((item: Wire) => item.name)
        .map((item: Wire) => ({
          name: item.name,
          marketplace: item.marketplace ?? null,
          version: item.version ?? null,
          scope: item.scope ?? null,
          enabled: item.enabled !== false,
          description: item.description ?? null,
        })),
      marketplaces: (data.marketplaces ?? [])
        .filter((item: Wire) => item.name)
        .map((item: Wire) => ({ name: item.name, repo: item.repo ?? null })),
    };
  },

  async skills(): Promise<Skill[] | null> {
    const data = await client.get<Wire[]>("/claude/skills");
    if (!Array.isArray(data)) return null;
    return data
      .filter((item) => item.name && item.id)
      .map((item) => ({
        name: item.name,
        id: item.id,
        description: item.description ?? null,
        plugin: item.plugin ?? null,
        pluginName: item.plugin_name ?? null,
        enabled: item.enabled !== false,
      }));
  },

  async skillFiles(plugin: string | null, skillId: string): Promise<string[]> {
    const data = await client.get<Wire>("/claude/skills/files", {
      skill: skillId,
      ...(plugin ? { plugin } : {}),
    });
    return data?.files ?? [];
  },

  skillFileUrl(plugin: string | null, skillId: string, file = "SKILL.md"): string {
    const base = baseUrlOf(profile());
    const pluginPart = plugin ? `&plugin=${encodeURIComponent(plugin)}` : "";
    return `${base}/claude/skills/file?skill=${encodeURIComponent(skillId)}${pluginPart}&file=${encodeURIComponent(file)}`;
  },

  async mcp(): Promise<McpServer[] | null> {
    const data = await client.get<Wire[]>("/claude/mcp");
    if (!Array.isArray(data)) return null;
    return data
      .filter((item) => item.name)
      .map((item) => ({
        name: item.name,
        type: item.type ?? null,
        detail: item.detail ?? null,
        enabled: item.enabled !== false,
      }));
  },

  async mcpToggle(name: string, enabled: boolean): Promise<ActionResult> {
    return toAction(await client.post<Wire>("/claude/mcp/toggle", { name, enabled }));
  },

  async mcpAdd(name: string, target: string, transport: string): Promise<ActionResult> {
    return toAction(await client.post<Wire>("/claude/mcp", { name, target, transport }));
  },

  async mcpRemove(name: string): Promise<ActionResult> {
    return toAction(await client.delete<Wire>(`/claude/mcp/${encodeURIComponent(name)}`));
  },

  async pluginAction(action: string, plugin: string): Promise<ActionResult> {
    return toAction(await client.post<Wire>("/claude/plugins/action", { action, plugin }));
  },

  async marketplaceAction(action: string, target: string): Promise<ActionResult> {
    return toAction(await client.post<Wire>("/claude/marketplaces/action", { action, target }));
  },

  async catalog(marketplace: string): Promise<CatalogPlugin[] | null> {
    const data = await client.get<Wire[]>(`/claude/marketplaces/${encodeURIComponent(marketplace)}/catalog`);
    if (!Array.isArray(data)) return null;
    return data
      .filter((item) => item.name)
      .map((item) => ({
        name: item.name,
        description: item.description ?? null,
        version: item.version ?? null,
        installed: item.installed === true,
      }));
  },

  async memories(project: string | null): Promise<Memories | null> {
    const data = await client.get<Wire>("/claude/memories", project ? { project } : undefined);
    if (!data) return null;
    const parse = (key: string): Memory[] =>
      (data[key] ?? [])
        .filter((item: Wire) => item.scope && item.name)
        .map((item: Wire) => ({ scope: item.scope, name: item.name, description: item.description ?? null }));
    return { global: parse("global"), project: parse("project") };
  },

  memoryUrl(scope: string, project: string | null, name: string): string {
    const base = baseUrlOf(profile());
    return `${base}/claude/memories/file?scope=${encodeURIComponent(scope)}&name=${encodeURIComponent(name)}&project=${encodeURIComponent(project ?? "")}`;
  },

  async deleteMemory(scope: string, project: string | null, name: string): Promise<boolean> {
    return (
      (await client.delete("/claude/memories", { scope, name, project: project ?? "" })) !== null
    );
  },
});

export const claudeApi = createClaudeApi(http, () => backend.active);
