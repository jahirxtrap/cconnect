import { http, type HttpClient } from "./http";

export interface LabeledOption {
  id: string;
  label: string;
}

export interface CommandOption {
  name: string;
  description: string;
  kind: string;
  requireConfirmation: boolean;
}

export interface CapabilitiesDefaults {
  permissionMode: string;
  effort: string;
  model: string;
  account: string;
}

export interface Capabilities {
  permissionModes: LabeledOption[];
  effortLevels: string[];
  models: LabeledOption[];
  colors: string[];
  commands: CommandOption[];
  accounts: LabeledOption[];
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

interface CapabilitiesWire extends VersionWire {
  permission_modes?: Array<{ id?: string; label?: string }>;
  effort_levels?: string[];
  models?: Array<{ id?: string; label?: string }>;
  colors?: string[];
  commands?: Array<{ name?: string; description?: string; kind?: string; require_confirmation?: boolean }>;
  accounts?: Array<{ id?: string; label?: string }>;
  defaults?: { permission_mode?: string; effort?: string; model?: string; account?: string };
}

const toVersion = (data: VersionWire): VersionInfo => ({
  serverVersion: data.version ?? null,
  supportedApp: data.supported_app ?? null,
  cliVersion: data.cli_version ?? null,
  supportedCli: data.supported_cli ?? null,
});

const toOptions = (raw: Array<{ id?: string; label?: string }> | undefined): LabeledOption[] =>
  (raw ?? []).filter((option) => option.id).map((option) => ({ id: option.id!, label: option.label ?? option.id! }));

export const createCapabilitiesApi = (http: HttpClient) => ({
  async versionInfo(): Promise<VersionInfo | null> {
    const data = await http.get<VersionWire>("/health");
    return data && toVersion(data);
  },

  async capabilities(): Promise<Capabilities | null> {
    const data = await http.get<CapabilitiesWire>("/capabilities");
    if (!data) return null;
    return {
      permissionModes: toOptions(data.permission_modes),
      effortLevels: data.effort_levels ?? [],
      models: toOptions(data.models),
      colors: data.colors ?? [],
      commands: (data.commands ?? [])
        .filter((command) => command.name)
        .map((command) => ({
          name: command.name!,
          description: command.description ?? "",
          kind: command.kind ?? "prompt",
          requireConfirmation: command.require_confirmation === true,
        })),
      accounts: toOptions(data.accounts),
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
