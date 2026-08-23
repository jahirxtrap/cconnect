import Check from "@lucide/svelte/icons/check";
import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
import Clock from "@lucide/svelte/icons/clock";
import Sparkles from "@lucide/svelte/icons/sparkles";
import Download from "@lucide/svelte/icons/download";
import ExternalLink from "@lucide/svelte/icons/external-link";
import File from "@lucide/svelte/icons/file";
import Folder from "@lucide/svelte/icons/folder";
import Info from "@lucide/svelte/icons/info";
import Lightbulb from "@lucide/svelte/icons/lightbulb";
import MessageSquare from "@lucide/svelte/icons/message-square";
import Pencil from "@lucide/svelte/icons/pencil";
import Plus from "@lucide/svelte/icons/plus";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import Search from "@lucide/svelte/icons/search";
import Settings from "@lucide/svelte/icons/settings";
import Shield from "@lucide/svelte/icons/shield";
import Trash2 from "@lucide/svelte/icons/trash-2";
import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
import X from "@lucide/svelte/icons/x";
import type { IconSource } from "./icons";

const ICONS: Record<string, IconSource> = {
  question: CircleQuestionMark,
  clock: Clock,
  sparkles: Sparkles,
  "message-square": MessageSquare,
  check: Check,
  x: X,
  plus: Plus,
  pencil: Pencil,
  trash: Trash2,
  download: Download,
  "external-link": ExternalLink,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  info: Info,
  alert: TriangleAlert,
  lightbulb: Lightbulb,
  shield: Shield,
  file: File,
  folder: Folder,
};

export const componentIcon = (name: string | null): IconSource | null => (name ? (ICONS[name] ?? null) : null);
