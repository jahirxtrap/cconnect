import { t } from "$lib/i18n/index.svelte";

const INDICATOR_TONES: Record<string, string> = {
  none: "bg-green",
  minor: "bg-yellow",
  major: "bg-orange",
  critical: "bg-red",
  maintenance: "bg-blue",
};

const INDICATOR_KEYS: Record<string, string> = {
  none: "STATUS_OPERATIONAL",
  minor: "STATUS_MINOR",
  major: "STATUS_MAJOR",
  critical: "STATUS_CRITICAL",
  maintenance: "STATUS_MAINTENANCE",
};

const COMPONENT_TONES: Record<string, string> = {
  operational: "bg-green",
  degraded_performance: "bg-yellow",
  partial_outage: "bg-orange",
  major_outage: "bg-red",
  under_maintenance: "bg-blue",
};

const COMPONENT_KEYS: Record<string, string> = {
  operational: "STATUS_COMPONENT_OPERATIONAL",
  degraded_performance: "STATUS_COMPONENT_DEGRADED",
  partial_outage: "STATUS_COMPONENT_PARTIAL",
  major_outage: "STATUS_COMPONENT_OUTAGE",
  under_maintenance: "STATUS_MAINTENANCE",
};

const INCIDENT_KEYS: Record<string, string> = {
  investigating: "INCIDENT_INVESTIGATING",
  identified: "INCIDENT_IDENTIFIED",
  monitoring: "INCIDENT_MONITORING",
  resolved: "INCIDENT_RESOLVED",
  postmortem: "INCIDENT_POSTMORTEM",
};

export const indicatorTone = (indicator: string): string => INDICATOR_TONES[indicator] ?? "bg-gray";

export const indicatorLabel = (indicator: string): string => t(INDICATOR_KEYS[indicator] ?? "STATUS_UNKNOWN");

export const componentTone = (status: string): string => COMPONENT_TONES[status] ?? "bg-gray";

export const componentLabel = (status: string): string => t(COMPONENT_KEYS[status] ?? "STATUS_UNKNOWN");

export const incidentLabel = (status: string): string => t(INCIDENT_KEYS[status] ?? "INCIDENT_INVESTIGATING");
