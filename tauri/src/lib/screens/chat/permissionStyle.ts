import FastForward from "@lucide/svelte/icons/fast-forward";
import FilePen from "@lucide/svelte/icons/file-pen";
import Lightbulb from "@lucide/svelte/icons/lightbulb";
import Repeat from "@lucide/svelte/icons/repeat";
import Shield from "@lucide/svelte/icons/shield";
import Zap from "@lucide/svelte/icons/zap";
import type { IconSource } from "$lib/ui/icons";

export interface PermissionStyle {
  icon: IconSource;
  tone: string;
}

const STYLES: Record<string, PermissionStyle> = {
  acceptEdits: { icon: FilePen, tone: "text-green" },
  plan: { icon: Lightbulb, tone: "text-blue" },
  bypassPermissions: { icon: Zap, tone: "text-red" },
  dontAsk: { icon: FastForward, tone: "text-orange" },
  auto: { icon: Repeat, tone: "text-cyan" },
};

export const permissionStyle = (mode: string): PermissionStyle =>
  STYLES[mode] ?? { icon: Shield, tone: "text-gray" };
