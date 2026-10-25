import { joined } from "./format";
import { plural, t } from "$lib/i18n/index.svelte";

export interface Reload {
  command: string;
  resident: boolean;
  failed: boolean;
  plugins: number | null;
  commands: number | null;
  agents: number | null;
  mcpServers: number | null;
  errors: number;
}

const RELOAD_TEXT: Record<string, { done: string; next: string; failed: string }> = {
  "reload-plugins": { done: "PLUGINS_RELOADED", next: "PLUGINS_RELOAD_NEXT", failed: "PLUGINS_RELOAD_FAILED" },
  "reload-skills": { done: "SKILLS_RELOADED", next: "SKILLS_RELOAD_NEXT", failed: "SKILLS_RELOAD_FAILED" },
};

const counted = (key: string, count: number | null) => count !== null && plural(key, count, count);

export const reloadText = (reload: Reload): string | null => {
  const text = RELOAD_TEXT[reload.command];
  if (!text) return null;
  if (!reload.resident) return t(text.next);
  if (reload.failed) return t(text.failed);
  const detail = joined(
    counted("PLUGINS_COUNT", reload.plugins),
    counted("COMMANDS_COUNT", reload.commands),
    counted("AGENTS_COUNT", reload.agents),
    counted("MCP_SERVERS_COUNT", reload.mcpServers),
    reload.errors > 0 && plural("ERRORS_COUNT", reload.errors, reload.errors),
  );
  return [t(text.done), detail].filter(Boolean).join("\n");
};
