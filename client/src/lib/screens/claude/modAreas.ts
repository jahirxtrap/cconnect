import { t } from "$lib/i18n/index.svelte";
import type { PluginReview } from "$lib/services/claudeApi";

const AREAS: Record<string, string> = {
  ui: "MOD_AREA_INTERFACE",
  prompt: "MOD_AREA_PROMPT",
  tool: "MOD_AREA_TOOLS",
  agent: "MOD_AREA_AGENTS",
  fs: "MOD_AREA_FILES",
  process: "MOD_AREA_PROGRAMS",
  http: "MOD_AREA_INTERNET",
  mcp: "MOD_AREA_MCP",
  model: "MOD_AREA_MODEL",
  env: "MOD_AREA_ENVIRONMENT",
  settings: "MOD_AREA_SETTINGS",
  audio: "MOD_AREA_AUDIO",
  session: "MOD_AREA_SESSION",
  turn: "MOD_AREA_SESSION",
  classic: "MOD_AREA_SESSION",
  command: "MOD_AREA_SESSION",
  config: "MOD_AREA_SESSION",
  state: "MOD_AREA_SESSION",
  store: "MOD_AREA_SESSION",
  clock: "MOD_AREA_SESSION",
  plugin: "MOD_AREA_SESSION",
  telemetry: "MOD_AREA_SESSION",
};

const NAMESPACED = /^(?:\$\.)?([a-z]+)\./;
const COMMAND_NAME = /^[\w:-]+$/;

export const modAreas = (review: PluginReview): string[] => {
  const found = new Set([...review.hooks, ...review.calls].flatMap((name) => NAMESPACED.exec(name)?.[1] ?? []));
  const known = new Set(Object.keys(AREAS).filter((area) => found.has(area)).map((area) => t(AREAS[area])));
  return [...known, ...[...found].filter((area) => !(area in AREAS))];
};

export const modCommands = (review: PluginReview): string[] =>
  review.commands.filter((name) => COMMAND_NAME.test(name)).map((name) => `/${name}`);
