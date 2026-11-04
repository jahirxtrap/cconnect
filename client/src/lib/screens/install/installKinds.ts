import BotMessageSquare from "@lucide/svelte/icons/bot-message-square";
import Package from "@lucide/svelte/icons/package";
import { skillName, type InstallKind, type InstallRequest } from "$lib/data/installRequest";
import { pathName } from "$lib/data/models";
import { CLAUDE_ICONS } from "$lib/screens/claude/ClaudeDetail.svelte";
import type { IconSource } from "$lib/ui/icons";

export const INSTALL_LABELS: Record<InstallKind, string> = {
  mcp: "MCP_SERVER",
  plugin: "PLUGIN",
  marketplace: "MARKETPLACE",
  agent: "ACP_AGENT",
  pack: "PACK",
  skill: "SKILL",
};

export const INSTALL_ICONS: Record<InstallKind, IconSource> = {
  mcp: CLAUDE_ICONS.mcp,
  plugin: CLAUDE_ICONS.plugins,
  marketplace: CLAUDE_ICONS.marketplaces,
  agent: BotMessageSquare,
  pack: Package,
  skill: CLAUDE_ICONS.skills,
};

const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

const fileOf = (url: string): string => {
  const address = new URL(url);
  return pathName(decoded(address.pathname)) ?? address.hostname;
};

export const installName = (request: InstallRequest): string => {
  switch (request.kind) {
    case "mcp":
      return request.name;
    case "plugin":
      return request.plugin;
    case "marketplace":
      return request.source;
    case "agent":
      return request.id;
    case "pack":
      return fileOf(request.url);
    case "skill":
      return skillName(request);
  }
};
