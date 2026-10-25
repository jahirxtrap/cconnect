export type HeadTone = "process" | "quiet" | "action" | "warning";

export const HEAD_TONES: Record<HeadTone, { icon: string; label: string; preview: string }> = {
  process: { icon: "text-accent", label: "text-on-surface", preview: "text-on-surface-variant" },
  quiet: { icon: "text-on-surface-variant", label: "text-on-surface-variant", preview: "text-on-surface-variant" },
  action: { icon: "text-accent", label: "text-accent", preview: "text-on-surface-variant" },
  warning: { icon: "text-orange", label: "text-orange", preview: "text-on-surface-variant" },
};
