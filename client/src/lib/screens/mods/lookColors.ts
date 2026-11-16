import { MOD_SCHEMES, type ModGlass, type ModLook, type ModScheme } from "$lib/data/modModels";
import { derivedColor, withAlpha } from "$lib/design/accents";
import { DERIVED_COLORS } from "$lib/design/packs/schema";
import { accentProperties } from "$lib/design/theme.svelte";

type Rule = string | [string, string];

const GRAPH: Record<string, Rule> = {
  "surface-0": ["gray-20", "gray-900"],
  "surface-1": ["gray-10", "gray-850"],
  "surface-2": ["gray-0", "gray-830"],
  "surface-3": ["gray-0", "gray-800"],
  "surface-panel": "surface-2",
  "surface-popover": "surface-3",
  "neutral-0": ["gray-0", "gray-900"],
  "neutral-400": ["gray-400", "gray-500"],
  "neutral-600": ["gray-600", "gray-300"],
  "neutral-900": ["gray-900", "gray-0"],
  "text-primary": ["neutral-900", "gray-50"],
  "text-secondary": ["neutral-600", "gray-200"],
  "text-muted": ["neutral-400", "gray-400"],
  "text-disabled": "@neutral-900/35",
  "fill-primary": "neutral-900",
  "on-primary": "neutral-0",
  border: "@neutral-900/10",
  "border-strong": "@neutral-900/20",
  "border-stronger": "@neutral-900/40",
  "bg-neutral": "@neutral-900/5",
  "bg-neutral-hover": "@neutral-900/10",
  "bg-user-message": "bg-neutral",
  "shadow-color": ["@gray-900/8", "'rgba(0, 0, 0, 0.24)"],
  "fill-accent": "role-accent-fill",
  "text-accent": ["role-accent-600", "role-accent-300"],
  "bg-accent": ["role-accent-100", "role-accent-800"],
  "on-accent": "role-accent-on",
  "border-accent": ["role-accent-250", "role-accent-700"],
  "fill-danger": "role-danger-fill",
  "text-danger": ["role-danger-600", "role-danger-300"],
  "bg-danger": ["role-danger-100", "role-danger-800"],
  "on-danger": "role-danger-on",
  "border-danger": ["role-danger-250", "role-danger-700"],
  "fill-success": "role-success-fill",
  "text-success": ["role-success-600", "role-success-400"],
  "bg-success": ["role-success-100", "role-success-800"],
  "on-success": "role-success-on",
  "border-success": ["role-success-250", "role-success-700"],
  "fill-warning": "role-warning-fill",
  "text-warning": ["role-warning-600", "role-warning-300"],
  "bg-warning": ["role-warning-100", "role-warning-800"],
  "on-warning": "role-warning-on",
  "border-warning": ["role-warning-250", "role-warning-700"],
  "fill-pro": "role-pro-fill",
  "text-pro": ["role-pro-600", "role-pro-300"],
  "bg-pro": ["role-pro-100", "role-pro-800"],
  "on-pro": "role-pro-on",
  "border-pro": ["role-pro-250", "role-pro-700"],
  "tooltip-bg": "role-tooltip-bg",
  "tooltip-fg": "role-tooltip-fg",
};

export const APP_COLORS: Record<string, string> = {
  "surface-0": "--c-background",
  "surface-1": "--c-surface",
  "surface-2": "--c-surface-nested",
  "surface-3": "--c-float",
  "surface-panel": "--c-surface-nested",
  "surface-popover": "--c-float",
  "text-primary": "--c-on-background",
  "text-secondary": "--c-on-surface-variant",
  "text-muted": "--c-faint",
  "text-disabled": "--c-faint",
  "fill-primary": "--c-on-background",
  "on-primary": "--c-background",
  border: "--c-outline-variant",
  "border-strong": "--c-outline",
  "border-stronger": "--c-outline",
  "bg-user-message": "--c-surface-variant",
  "fill-accent": "--c-accent",
  "text-accent": "--c-blue",
  "bg-accent": "--c-blue-bg",
  "on-accent": "--c-on-accent",
  "border-accent": "--c-accent-ring",
  "fill-danger": "--c-red",
  "text-danger": "--c-red",
  "bg-danger": "--c-red-bg",
  "on-danger": "--c-background",
  "border-danger": "--c-red",
  "fill-success": "--c-green",
  "text-success": "--c-green",
  "bg-success": "--c-green-bg",
  "on-success": "--c-background",
  "border-success": "--c-green",
  "fill-warning": "--c-yellow",
  "text-warning": "--c-yellow",
  "bg-warning": "--c-surface-variant",
  "on-warning": "--c-background",
  "border-warning": "--c-yellow",
  "fill-pro": "--c-purple",
  "text-pro": "--c-purple",
  "bg-pro": "--c-surface-variant",
  "on-pro": "--c-background",
  "border-pro": "--c-purple",
};

const CHAT_TOKENS: Record<string, string> = {
  background: "surface-0",
  surface: "surface-1",
  "surface-nested": "surface-2",
  "surface-variant": "surface-3",
  float: "surface-popover",
  "on-background": "text-primary",
  "on-surface-variant": "text-secondary",
  faint: "text-muted",
  outline: "border-strong",
  "outline-variant": "border",
  error: "text-danger",
  "on-accent": "on-accent",
  red: "text-danger",
  green: "text-success",
  blue: "text-accent",
  yellow: "text-warning",
  orange: "fill-warning",
  purple: "text-pro",
  gray: "text-muted",
};

const STRONG_TOKENS: Record<string, string> = {
  outline: "border-stronger",
  "outline-variant": "border-strong",
};

const ACCENT = "fill-accent";

const LITERAL = "'";
const ALPHA = /^@([\w-]+)\/([\d.]+)$/;
const RAW = /^(#[0-9a-f]{3,8}|rgba?\(.*\)|hsla?\(.*\)|transparent)$/i;
const PERCENT = 100;
const MAX_DEPTH = 8;

export const lookScheme = (look: ModLook | null, dark: boolean): ModScheme => {
  if (look?.scheme) return look.scheme;
  const given = look?.colors ? MOD_SCHEMES.filter((scheme) => look.colors?.inputs[scheme]) : [];
  return given.length === 1 ? given[0] : dark ? "dark" : "light";
};

export const lookColor = (name: string, inputs: Record<string, string>, scheme: ModScheme, depth = 0): string | null => {
  if (depth > MAX_DEPTH) return null;
  const own = inputs[name];
  if (own) return own;
  const rule = GRAPH[name];
  if (rule === undefined) return null;
  const chosen = Array.isArray(rule) ? rule[scheme === "dark" ? 1 : 0] : rule;
  if (chosen.startsWith(LITERAL)) return chosen.slice(LITERAL.length);
  const alpha = ALPHA.exec(chosen);
  if (alpha) {
    const base = lookColor(alpha[1], inputs, scheme, depth + 1);
    return base ? withAlpha(base, Number(alpha[2]) / PERCENT) : null;
  }
  return lookColor(chosen, inputs, scheme, depth + 1);
};

export const lookStyle = (look: ModLook, scheme: ModScheme, own: Readonly<Record<string, string>> | null): string => {
  const inputs = look.colors?.inputs[scheme];
  if (!inputs && !own) return "";
  const names = { ...CHAT_TOKENS, ...(look.colors?.contrast === "more" ? STRONG_TOKENS : {}) };
  const colors: Record<string, string> = inputs ? {} : { ...own };
  if (inputs) {
    for (const [token, name] of Object.entries(names)) {
      const value = lookColor(name, inputs, scheme);
      if (value) colors[token] = value;
    }
    for (const [token, rule] of Object.entries(DERIVED_COLORS)) {
      const value = derivedColor(rule, colors);
      if (value) colors[token] = value;
    }
  }
  const accent = inputs ? lookColor(ACCENT, inputs, scheme) : null;
  const declarations: [string, string][] = [
    ...Object.entries(colors).map(([token, value]): [string, string] => [`--c-${token}`, value]),
    ...(accent ? accentProperties(accent, colors) : []),
    ...(colors["on-accent"] ? [["--c-on-accent", colors["on-accent"]] as [string, string]] : []),
    ["color", "var(--c-on-background)"],
    ["color-scheme", scheme],
  ];
  return declarations.map(([name, value]) => `${name}: ${value}`).join("; ");
};

const GLASS_TOKENS: Record<string, string> = {
  surface: "card-bg",
  "surface-nested": "nested-bg",
  "surface-variant": "nested-bg",
  hover: "hover-glass",
  "on-surface-variant": "on-surface-variant-glass",
  faint: "faint-glass",
  outline: "outline-glass",
  "outline-variant": "outline-variant-glass",
};

export const glassRemapStyle = (): string =>
  Object.entries(GLASS_TOKENS)
    .map(([token, glass]) => `--c-${token}: var(--c-${glass})`)
    .join("; ");

const BLOCK_TINTS = ["card-bg", "nested-bg", "code-bg"];

export const glassStyle = (glass: ModGlass): string =>
  glass.tint
    ? BLOCK_TINTS.map((token) => `--c-${token}: ${withAlpha(glass.tint ?? "", DERIVED_COLORS[token].alpha)}`).join("; ")
    : "";

export const groundColor = (value: string, look: ModLook, scheme: ModScheme): string | null => {
  if (RAW.test(value)) return value;
  const inputs = look.colors?.inputs[scheme];
  const own = inputs ? lookColor(value, inputs, scheme) : null;
  if (own) return own;
  const token = APP_COLORS[value];
  return token ? `var(${token})` : null;
};
