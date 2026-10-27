import { t } from "$lib/i18n/index.svelte";
import { toCommands, type CommandOption, type CommandWire } from "$lib/services/capabilitiesApi";
import { linesOf } from "./format";
import { parseIsoMillis } from "./time";

export type AgentStatus = "connecting" | "ready" | "auth" | "error" | "closed";

export type AgentOptionType = "select" | "boolean";

export interface AgentChoice {
  value: string;
  name: string;
  description: string;
  group: string | null;
}

export interface AgentOption {
  id: string;
  name: string;
  description: string;
  category: string;
  type: AgentOptionType;
  current: string | boolean | null;
  choices: AgentChoice[];
}

export interface AgentMethod {
  id: string;
  name: string;
  description: string;
  terminal: boolean;
}

export interface AgentCost {
  amount: number;
  currency: string;
}

export interface AgentUsage {
  used: number | null;
  size: number | null;
  cost: AgentCost | null;
}

export interface AgentSessionSupport {
  list: boolean;
  load: boolean;
  resume: boolean;
  close: boolean;
  delete: boolean;
}

export interface AgentPromptSupport {
  image: boolean;
  audio: boolean;
  embedded: boolean;
}

export interface AgentInfo {
  name: string | null;
  title: string | null;
  version: string | null;
}

export interface AgentState {
  agent: string;
  status: AgentStatus;
  reason: string | null;
  detail: string;
  sessionId: string | null;
  title: string | null;
  options: AgentOption[];
  commands: CommandOption[];
  usage: AgentUsage | null;
  methods: AgentMethod[];
  prompt: AgentPromptSupport;
  sessions: AgentSessionSupport;
  logout: boolean;
  info: AgentInfo | null;
}

export type AgentSource = "registry" | "custom";

export type AgentProtocol = "acp" | "command";

export const AGENT_PROTOCOLS: AgentProtocol[] = ["acp", "command"];

export interface InstalledAgent {
  id: string;
  name: string;
  source: AgentSource;
  protocol: AgentProtocol;
  description: string;
  purpose: string;
  version: string | null;
  kind: string | null;
  program: string;
  args: string[];
  editArgs: string[];
  bypassArgs: string[];
  envNames: string[];
  enabled: boolean;
  icon: boolean;
}

export interface CatalogAgent {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string | null;
  website: string | null;
  authors: string[];
  license: string | null;
  runnable: string | null;
  needs: string | null;
  installed: string | null;
}

export interface AgentSession {
  sessionId: string;
  title: string | null;
  updatedAt: number | null;
}

export interface AgentLogin {
  command: string[];
  env: Record<string, string>;
}

export interface AgentFailure {
  reason: string;
  detail: string;
}

type Wire = Record<string, unknown>;

const STATUSES: AgentStatus[] = ["connecting", "ready", "auth", "error", "closed"];
const MILLIS_PER_SECOND = 1000;

const text = (raw: Wire, key: string): string | null => (typeof raw[key] === "string" ? (raw[key] as string) : null);
const number = (raw: Wire, key: string): number | null => (typeof raw[key] === "number" ? (raw[key] as number) : null);
const flag = (raw: Wire, key: string): boolean => raw[key] === true;
const list = (raw: Wire, key: string): Wire[] => (Array.isArray(raw[key]) ? (raw[key] as Wire[]) : []);
const record = (raw: Wire, key: string): Wire =>
  raw[key] && typeof raw[key] === "object" && !Array.isArray(raw[key]) ? (raw[key] as Wire) : {};
const strings = (raw: Wire, key: string): string[] =>
  Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((item): item is string => typeof item === "string") : [];

const toChoice = (raw: Wire): AgentChoice => ({
  value: text(raw, "value") ?? "",
  name: text(raw, "name") ?? text(raw, "value") ?? "",
  description: text(raw, "description") ?? "",
  group: text(raw, "group") || null,
});

const toOption = (raw: Wire): AgentOption | null => {
  const id = text(raw, "id");
  const type = text(raw, "type");
  if (!id || (type !== "select" && type !== "boolean")) return null;
  const current = raw.current;
  return {
    id,
    name: text(raw, "name") ?? "",
    description: text(raw, "description") ?? "",
    category: text(raw, "category") ?? "",
    type,
    current: typeof current === "string" || typeof current === "boolean" ? current : null,
    choices: list(raw, "choices").map(toChoice),
  };
};

const toCost = (raw: unknown): AgentCost | null => {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as Wire;
  const amount = number(wire, "amount");
  const currency = text(wire, "currency");
  return amount === null || !currency ? null : { amount, currency };
};

const toUsage = (raw: unknown): AgentUsage | null => {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as Wire;
  return { used: number(wire, "used"), size: number(wire, "size"), cost: toCost(wire.cost) };
};

const toInfo = (raw: unknown): AgentInfo | null => {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as Wire;
  return { name: text(wire, "name"), title: text(wire, "title"), version: text(wire, "version") };
};

export const toAgentState = (raw: Wire): AgentState => {
  const status = text(raw, "status") as AgentStatus | null;
  const prompt = record(raw, "prompt");
  const sessions = record(raw, "sessions");
  return {
    agent: text(raw, "agent") ?? "",
    status: status && STATUSES.includes(status) ? status : "connecting",
    reason: text(raw, "reason"),
    detail: text(raw, "detail") ?? "",
    sessionId: text(raw, "session_id"),
    title: text(raw, "title"),
    options: list(raw, "options").flatMap((option) => toOption(option) ?? []),
    commands: toCommands(list(raw, "commands") as CommandWire[]),
    usage: toUsage(raw.usage),
    methods: list(raw, "methods").flatMap((method) => {
      const id = text(method, "id");
      return id
        ? [{ id, name: text(method, "name") ?? id, description: text(method, "description") ?? "", terminal: flag(method, "terminal") }]
        : [];
    }),
    prompt: { image: flag(prompt, "image"), audio: flag(prompt, "audio"), embedded: flag(prompt, "embedded") },
    sessions: {
      list: flag(sessions, "list"),
      load: flag(sessions, "load"),
      resume: flag(sessions, "resume"),
      close: flag(sessions, "close"),
      delete: flag(sessions, "delete"),
    },
    logout: flag(raw, "logout"),
    info: toInfo(raw.info),
  };
};

export const toInstalledAgent = (raw: Wire): InstalledAgent => ({
  id: text(raw, "id") ?? "",
  name: text(raw, "name") ?? "",
  source: text(raw, "source") === "registry" ? "registry" : "custom",
  protocol: text(raw, "protocol") === "command" ? "command" : "acp",
  description: text(raw, "description") ?? "",
  purpose: text(raw, "purpose") ?? "",
  version: text(raw, "version"),
  kind: text(raw, "kind"),
  program: text(raw, "program") ?? "",
  args: strings(raw, "args"),
  editArgs: strings(raw, "edit_args"),
  bypassArgs: strings(raw, "bypass_args"),
  envNames: strings(raw, "env"),
  enabled: raw.enabled !== false,
  icon: flag(raw, "icon"),
});

export const toCatalogAgent = (raw: Wire): CatalogAgent => ({
  id: text(raw, "id") ?? "",
  name: text(raw, "name") ?? text(raw, "id") ?? "",
  description: text(raw, "description") ?? "",
  version: text(raw, "version") ?? "",
  icon: text(raw, "icon"),
  website: text(raw, "website"),
  authors: strings(raw, "authors"),
  license: text(raw, "license"),
  runnable: text(raw, "runnable"),
  needs: text(raw, "needs"),
  installed: text(raw, "installed"),
});

const timeOf = (value: unknown): number | null => {
  if (typeof value === "number") return value * MILLIS_PER_SECOND;
  return typeof value === "string" ? parseIsoMillis(value) : null;
};

export const toAgentSession = (raw: Wire): AgentSession | null => {
  const sessionId = text(raw, "session_id");
  return sessionId ? { sessionId, title: text(raw, "title") || null, updatedAt: timeOf(raw.updated_at) } : null;
};

export const toAgentFailure = (raw: unknown): AgentFailure | null => {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as Wire;
  const reason = text(wire, "reason");
  return reason ? { reason, detail: text(wire, "detail") ?? "" } : null;
};

const REASON_KEYS: Record<string, string> = {
  missing: "AGENT_REASON_MISSING",
  registry: "AGENT_REASON_REGISTRY",
  download: "AGENT_REASON_DOWNLOAD",
  checksum: "AGENT_REASON_CHECKSUM",
  install: "AGENT_REASON_INSTALL",
  node: "AGENT_REASON_NODE",
  platform: "AGENT_REASON_PLATFORM",
};

export const agentReasonText = (reason: string | null): string | null =>
  reason && REASON_KEYS[reason] ? t(REASON_KEYS[reason]) : null;

export const agentFailureText = (failure: AgentFailure): string =>
  [agentReasonText(failure.reason), failure.detail].filter(Boolean).join("\n");

export const envText = (env: Record<string, string>): string =>
  Object.entries(env)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");

export const envOf = (text: string): Record<string, string> =>
  Object.fromEntries(
    linesOf(text)
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1)]),
  );

const STOP_KEYS: Record<string, string> = {
  max_tokens: "AGENT_STOP_MAX_TOKENS",
  max_turn_requests: "AGENT_STOP_MAX_TURN_REQUESTS",
  refusal: "AGENT_STOP_REFUSAL",
};

export const agentStopText = (reason: string | null): string => {
  const key = STOP_KEYS[reason ?? ""];
  return key ? t(key) : (reason ?? "");
};

export const chosenName = (option: AgentOption): string =>
  option.choices.find((choice) => choice.value === option.current)?.name ?? String(option.current ?? "");
