import { CLIENT_CAPABILITIES } from "$lib/data/clientCapabilities";
import { http, type HttpClient } from "./http";

export interface LabeledOption {
  id: string;
  label: string;
}

export interface AccountOption extends LabeledOption {
  local: boolean;
}

export interface CommandOption {
  name: string;
  description: string;
  kind: string;
  requireConfirmation: boolean;
  argumentHint: string;
  aliases: string[];
}

export interface McpTool {
  name: string;
  description: string;
  group: string | null;
  groupDescription: string | null;
}

export interface FastMode {
  state: string;
  disabledReason: string | null;
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  resolvedModel: string;
  effortLevels: string[];
  contextWindow: number | null;
  fastMode: boolean;
  autoMode: boolean;
}

export interface CapabilitiesDefaults {
  permissionMode: string;
  effort: string;
  model: string;
  account: string;
}

export interface Capabilities {
  permissionModes: LabeledOption[];
  models: ModelOption[];
  outputStyles: string[];
  fastMode: FastMode;
  colors: string[];
  commands: CommandOption[];
  accounts: AccountOption[];
  mcpTools: McpTool[];
  defaults: CapabilitiesDefaults;
  serverVersion: string | null;
  supportedApp: string | null;
  cliVersion: string | null;
  supportedCli: string | null;
}

export interface VersionInfo {
  serverVersion: string | null;
  supportedApp: string | null;
  cliVersion: string | null;
  supportedCli: string | null;
}

interface VersionWire {
  version?: string;
  supported_app?: string;
  cli_version?: string;
  supported_cli?: string;
}

interface ModelWire {
  id?: string;
  label?: string;
  description?: string;
  resolved_model?: string;
  effort_levels?: string[];
  context_window?: number | null;
  fast_mode?: boolean;
  auto_mode?: boolean;
}

interface CapabilitiesWire extends VersionWire {
  permission_modes?: Array<{ id?: string; label?: string }>;
  models?: ModelWire[];
  output_styles?: string[];
  fast_mode?: { state?: string; disabled_reason?: string | null };
  colors?: string[];
  commands?: Array<{
    name?: string;
    description?: string;
    kind?: string;
    require_confirmation?: boolean;
    argument_hint?: string;
    aliases?: string[];
  }>;
  accounts?: Array<{ id?: string; label?: string; local?: boolean }>;
  defaults?: { permission_mode?: string; effort?: string; model?: string; account?: string };
  mcp_tools?: Array<{ name?: string; description?: string; group?: string; group_description?: string }>;
}

const toVersion = (data: VersionWire): VersionInfo => ({
  serverVersion: data.version ?? null,
  supportedApp: data.supported_app ?? null,
  cliVersion: data.cli_version ?? null,
  supportedCli: data.supported_cli ?? null,
});

const toOptions = (raw: Array<{ id?: string; label?: string }> | undefined): LabeledOption[] =>
  (raw ?? []).filter((option) => option.id).map((option) => ({ id: option.id!, label: option.label ?? option.id! }));

export const effortLevelsFor = (capabilities: Capabilities | null, model: string): string[] =>
  capabilities?.models.find((item) => item.id === model)?.effortLevels ?? [];

export const commandToken = (text: string): string | null => {
  const body = text.trimStart();
  if (!body.startsWith("/")) return null;
  const token = body.slice(1).split(/\s/, 1)[0];
  return body.length > token.length + 1 && /\s/.test(body[token.length + 1]) ? null : token;
};

export const commandFor = (capabilities: Capabilities | null, text: string): CommandOption | null => {
  const body = text.trim();
  if (!body.startsWith("/")) return null;
  const token = body.slice(1).split(/\s+/)[0].toLowerCase();
  if (!token) return null;
  return (
    capabilities?.commands.find(
      (command) =>
        command.name.toLowerCase() === token ||
        command.aliases.some((alias) => alias.toLowerCase() === token),
    ) ?? null
  );
};

export const contextWindowFor = (capabilities: Capabilities | null, model: string): number | null =>
  capabilities?.models.find((item) => item.id === model)?.contextWindow ?? null;

export const createCapabilitiesApi = (http: HttpClient) => ({
  async versionInfo(): Promise<VersionInfo | null> {
    const data = await http.get<VersionWire>("/health");
    return data && toVersion(data);
  },

  async capabilities(account = ""): Promise<Capabilities | null> {
    const data = await http.get<CapabilitiesWire>("/capabilities", {
      capabilities: CLIENT_CAPABILITIES.join(","),
      ...(account ? { account } : {}),
    });
    if (!data) return null;
    return {
      permissionModes: toOptions(data.permission_modes),
      models: (data.models ?? [])
        .filter((model) => model.id)
        .map((model) => ({
          id: model.id!,
          label: model.label ?? model.id!,
          description: model.description ?? "",
          resolvedModel: model.resolved_model ?? "",
          effortLevels: model.effort_levels ?? [],
          contextWindow: model.context_window ?? null,
          fastMode: model.fast_mode === true,
          autoMode: model.auto_mode === true,
        })),
      outputStyles: data.output_styles ?? [],
      fastMode: {
        state: data.fast_mode?.state ?? "off",
        disabledReason: data.fast_mode?.disabled_reason ?? null,
      },
      colors: data.colors ?? [],
      commands: (data.commands ?? [])
        .filter((command) => command.name)
        .map((command) => ({
          name: command.name!,
          description: command.description ?? "",
          kind: command.kind ?? "prompt",
          requireConfirmation: command.require_confirmation === true,
          argumentHint: command.argument_hint ?? "",
          aliases: command.aliases ?? [],
        })),
      accounts: (data.accounts ?? [])
        .filter((option) => option.id)
        .map((option) => ({
          id: option.id!,
          label: option.label ?? option.id!,
          local: option.local === true,
        })),
      mcpTools: (data.mcp_tools ?? [])
        .filter((tool) => tool.name)
        .map((tool) => ({
          name: tool.name!,
          description: tool.description ?? "",
          group: tool.group ?? null,
          groupDescription: tool.group_description ?? null,
        })),
      defaults: {
        permissionMode: data.defaults?.permission_mode ?? "",
        effort: data.defaults?.effort ?? "",
        model: data.defaults?.model ?? "",
        account: data.defaults?.account ?? "",
      },
      ...toVersion(data),
    };
  },
});

export const capabilitiesApi = createCapabilitiesApi(http);
