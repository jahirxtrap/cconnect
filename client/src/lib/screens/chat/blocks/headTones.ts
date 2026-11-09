import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
import X from "@lucide/svelte/icons/x";
import type { IconSource } from "$lib/ui/icons";

export type HeadTone = "process" | "quiet" | "action" | "warning";

export const HEAD_TONES: Record<HeadTone, { icon: string; label: string; preview: string }> = {
  process: { icon: "text-accent", label: "text-on-surface", preview: "text-on-surface-variant" },
  quiet: { icon: "text-on-surface-variant", label: "text-on-surface-variant", preview: "text-on-surface-variant" },
  action: { icon: "text-accent", label: "text-accent", preview: "text-on-surface-variant" },
  warning: { icon: "text-orange", label: "text-orange", preview: "text-on-surface-variant" },
};

export type HeadStatus = "failed" | "stopped";

export const HEAD_STATUS: Record<HeadStatus, { icon: IconSource; color: string; label: string }> = {
  failed: { icon: X, color: "text-red", label: "TOOL_FAILED" },
  stopped: { icon: TriangleAlert, color: "text-orange", label: "INTERRUPTED" },
};

export const headStatusOf = (failed: boolean, blockedBy: string | null = null): HeadStatus | null =>
  blockedBy ? "stopped" : failed ? "failed" : null;
