import type { AgentProtocol } from "$lib/data/agentModels";

export const AGENT_KIND_LABELS: Record<string, string> = {
  binary: "AGENT_KIND_BINARY",
  npx: "AGENT_KIND_NPM",
  uvx: "AGENT_KIND_PYTHON",
};

export const AGENT_PROTOCOL_LABELS: Record<AgentProtocol, string> = {
  acp: "AGENT_PROTOCOL_ACP",
  command: "AGENT_PROTOCOL_COMMAND",
};
