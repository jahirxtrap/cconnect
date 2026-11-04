import { decodeBase64 } from "./base64";

export const INSTALL_LINK = "cconnect://install/";
const CURSOR_MCP_LINK = "cursor://anysphere.cursor-deeplink/mcp/install";
const SECURE = "https:";
const REMOTE_TYPES: Record<string, "http" | "sse"> = { http: "http", "streamable-http": "http", sse: "sse" };
const GITHUB_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const GITHUB_FOLDER = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/(?:tree|blob)\/([^/]+)\/?(.*)$/;
const SKILL_FILE = /(^|\/)SKILL\.md$/;
const EDGE_SLASHES = /^\/+|\/+$/g;

export type McpConfig =
  | { type: "stdio"; command: string; args: string[]; env: Record<string, string> }
  | { type: "http" | "sse"; url: string; headers: Record<string, string> };

export type InstallRequest =
  | { kind: "mcp"; name: string; config: McpConfig }
  | { kind: "plugin"; plugin: string; marketplace: string; source: string | null }
  | { kind: "marketplace"; source: string }
  | { kind: "agent"; id: string }
  | { kind: "pack"; url: string }
  | { kind: "skill"; source: string; path: string; ref: string };

export type InstallKind = InstallRequest["kind"];

type Entry = Record<string, unknown>;

const isEntry = (value: unknown): value is Entry => !!value && typeof value === "object" && !Array.isArray(value);

const trimmed = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

const strings = (value: unknown): Record<string, string> | null => {
  if (value === undefined) return {};
  if (!isEntry(value)) return null;
  const entries = Object.entries(value);
  return entries.every(([, item]) => typeof item === "string") ? (Object.fromEntries(entries) as Record<string, string>) : null;
};

const pairs = (lines: string[], separator: string): Record<string, string> | null => {
  const found: Record<string, string> = {};
  for (const line of lines) {
    const at = line.indexOf(separator);
    if (at <= 0) return null;
    found[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return found;
};

const decodedJson = (text: string): unknown => {
  const source = text.trim();
  try {
    if (source.startsWith("{")) return JSON.parse(source);
    const standard = source.replace(/[ -]/g, "+").replace(/_/g, "/");
    const padded = standard.padEnd(standard.length + ((4 - (standard.length % 4)) % 4), "=");
    return JSON.parse(new TextDecoder().decode(decodeBase64(padded)));
  } catch {
    return null;
  }
};

const mcpEntry = (raw: unknown): McpConfig | null => {
  const entry = typeof raw === "string" ? decodedJson(raw) : raw;
  if (!isEntry(entry)) return null;
  const url = trimmed(entry.url);
  if (url) {
    const type = REMOTE_TYPES[trimmed(entry.type) ?? "http"];
    const headers = strings(entry.headers);
    return type && headers ? { type, url, headers } : null;
  }
  const command = trimmed(entry.command);
  const args = entry.args ?? [];
  const env = strings(entry.env);
  if (!command || !env || !Array.isArray(args) || !args.every((arg) => typeof arg === "string")) return null;
  return { type: "stdio", command, args, env };
};

const mcpOfLink = (params: URLSearchParams): McpConfig | null => {
  const config = params.get("config");
  if (config) return mcpEntry(config);
  const headers = pairs(params.getAll("header"), ":");
  const env = pairs(params.getAll("env"), "=");
  if (!headers || !env) return null;
  return params.get("url")
    ? mcpEntry({ url: params.get("url"), type: params.get("type") ?? undefined, headers })
    : mcpEntry({ command: params.get("command"), args: params.getAll("arg"), env });
};

const secure = (url: string | null): url is string => {
  try {
    return !!url && new URL(url).protocol === SECURE;
  } catch {
    return false;
  }
};

const skillOf = (source: string | null, path: string | null, ref: string | null): InstallRequest | null => {
  const folder = source ? GITHUB_FOLDER.exec(source) : null;
  const repo = folder ? folder[1] : source;
  if (!repo || !(GITHUB_REPO.test(repo) || secure(repo))) return null;
  return {
    kind: "skill",
    source: repo,
    path: (folder ? folder[3] : (path ?? "")).replace(SKILL_FILE, "").replace(EDGE_SLASHES, ""),
    ref: (folder ? folder[2] : ref) ?? "",
  };
};

const requestOf = (
  kind: string | null,
  text: (key: string) => string | null,
  mcp: () => McpConfig | null,
): InstallRequest | null => {
  switch (kind) {
    case "mcp": {
      const name = text("name");
      const config = mcp();
      return name && config ? { kind, name, config } : null;
    }
    case "plugin": {
      const [plugin, marketplace, ...rest] = (text("name") ?? "").split("@");
      return plugin && marketplace && !rest.length ? { kind, plugin, marketplace, source: text("source") } : null;
    }
    case "marketplace": {
      const source = text("source");
      return source ? { kind, source } : null;
    }
    case "agent": {
      const id = text("id");
      return id ? { kind, id } : null;
    }
    case "pack": {
      const url = text("url");
      return secure(url) ? { kind, url } : null;
    }
    case "skill":
      return skillOf(text("source"), text("path"), text("ref"));
    default:
      return null;
  }
};

export const isInstallLink = (url: string): boolean => url.startsWith(INSTALL_LINK) || url.startsWith(CURSOR_MCP_LINK);

export const installFromLink = (link: string): InstallRequest | null => {
  const at = link.indexOf("?");
  const path = at < 0 ? link : link.slice(0, at);
  const params = new URLSearchParams(at < 0 ? "" : link.slice(at + 1));
  const kind = link.startsWith(CURSOR_MCP_LINK)
    ? "mcp"
    : link.startsWith(INSTALL_LINK)
      ? path.slice(INSTALL_LINK.length).replace(/\/+$/, "")
      : null;
  return requestOf(kind, (key) => trimmed(params.get(key)), () => mcpOfLink(params));
};

export const installFromItem = (item: Entry): InstallRequest | null => {
  const link = trimmed(item.link);
  if (link) return installFromLink(link);
  return requestOf(trimmed(item.kind), (key) => trimmed(item[key]), () => mcpEntry(item.config ?? item));
};

export const installTarget = (request: InstallRequest): string => {
  switch (request.kind) {
    case "mcp":
      return request.config.type === "stdio"
        ? [request.config.command, ...request.config.args].join(" ")
        : request.config.url;
    case "plugin":
      return `${request.plugin}@${request.marketplace}`;
    case "marketplace":
      return request.source;
    case "agent":
      return request.id;
    case "pack":
      return request.url;
    case "skill":
      return request.path ? `${request.source}/${request.path}` : request.source;
  }
};

export const skillName = (request: { source: string; path: string }): string =>
  (request.path || request.source.replace(/\.git$/, "")).replace(EDGE_SLASHES, "").split("/").pop() ?? request.source;
