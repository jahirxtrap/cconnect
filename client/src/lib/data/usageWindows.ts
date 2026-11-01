import { t } from "$lib/i18n/index.svelte";

export const ALERT_PERCENT = 90;

const WINDOW_LABELS: Record<string, string> = {
  session: "USAGE_SESSION",
  week: "USAGE_WEEK",
  spend: "USAGE_SPEND",
};

export const usageWindowLabel = (id: string): string => (id in WINDOW_LABELS ? t(WINDOW_LABELS[id]) : id);

export interface LimitWindow {
  id: string;
  percent: number;
  severity: string | null;
}

export type LimitTone = "accent" | "orange" | "red";

const SEVERITY_TONES: Record<string, LimitTone> = {
  warning: "orange",
  critical: "red",
};

export const severityTone = (severity: string | null): LimitTone =>
  (severity && SEVERITY_TONES[severity]) || "accent";

export const limitTone = (window: LimitWindow): LimitTone => severityTone(window.severity);

export interface UsageShare {
  key: string;
  label: string;
  percent: number;
}

export interface UsageWindow {
  id: string;
  percent: number;
  resetsAt: string | null;
  unused: boolean;
  detail: string | null;
  severity: string | null;
  model: string | null;
  share: number | null;
  breakdown: UsageShare[];
}

export const usageTitle = (window: UsageWindow): string =>
  window.model ? t("USAGE_WEEK_MODEL", window.model) : usageWindowLabel(window.id);

export interface Usage {
  plan: string | null;
  windows: UsageWindow[];
  error: string | null;
}

type Wire = Record<string, unknown>;

const textOf = (raw: Wire, key: string): string | null => (typeof raw[key] === "string" ? (raw[key] as string) : null);

const numberOf = (raw: Wire, key: string): number | null => (typeof raw[key] === "number" ? (raw[key] as number) : null);

const listOf = (raw: Wire, key: string): Wire[] =>
  Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((item): item is Wire => !!item && typeof item === "object") : [];

export const usageOf = (data: Wire): Usage => ({
  plan: textOf(data, "plan"),
  windows: listOf(data, "windows").map((window) => ({
    id: textOf(window, "id") ?? "",
    percent: numberOf(window, "percent") ?? 0,
    resetsAt: textOf(window, "resets_at"),
    unused: window.unused === true,
    detail: textOf(window, "detail"),
    severity: textOf(window, "severity"),
    model: textOf(window, "model"),
    share: numberOf(window, "share"),
    breakdown: listOf(window, "breakdown").map((row) => ({
      key: textOf(row, "key") ?? "",
      label: textOf(row, "label") ?? "",
      percent: numberOf(row, "percent") ?? 0,
    })),
  })),
  error: textOf(data, "error"),
});
