import AlarmClock from "@lucide/svelte/icons/alarm-clock";
import ArrowRightLeft from "@lucide/svelte/icons/arrow-right-left";
import Bot from "@lucide/svelte/icons/bot";
import Braces from "@lucide/svelte/icons/braces";
import CalendarClock from "@lucide/svelte/icons/calendar-clock";
import ClipboardCheck from "@lucide/svelte/icons/clipboard-check";
import FilePen from "@lucide/svelte/icons/file-pen";
import FileText from "@lucide/svelte/icons/file-text";
import GitBranch from "@lucide/svelte/icons/git-branch";
import Globe from "@lucide/svelte/icons/globe";
import Lightbulb from "@lucide/svelte/icons/lightbulb";
import RadioTower from "@lucide/svelte/icons/radio-tower";
import Search from "@lucide/svelte/icons/search";
import Send from "@lucide/svelte/icons/send";
import SquareTerminal from "@lucide/svelte/icons/square-terminal";
import Trash2 from "@lucide/svelte/icons/trash-2";
import Unplug from "@lucide/svelte/icons/unplug";
import Wand from "@lucide/svelte/icons/wand";
import Workflow from "@lucide/svelte/icons/workflow";
import Wrench from "@lucide/svelte/icons/wrench";
import type { IconSource } from "./icons";

const TOOL_ICONS: Record<string, IconSource> = {
  Bash: SquareTerminal,
  BashOutput: SquareTerminal,
  KillShell: SquareTerminal,
  Monitor: SquareTerminal,
  PowerShell: SquareTerminal,
  TaskOutput: SquareTerminal,
  TaskStop: SquareTerminal,
  Execute: SquareTerminal,
  Read: FileText,
  Grep: Search,
  Glob: Search,
  ToolSearch: Search,
  Search: Search,
  WebFetch: Globe,
  WebSearch: Globe,
  Fetch: Globe,
  Skill: Wand,
  LSP: Braces,
  StructuredOutput: Braces,
  ListMcpResourcesTool: Unplug,
  ReadMcpResourceTool: Unplug,
  ReadMcpResourceDirTool: Unplug,
  Edit: FilePen,
  Delete: Trash2,
  Move: ArrowRightLeft,
  Think: Lightbulb,
  EnterPlanMode: Lightbulb,
  CronCreate: CalendarClock,
  CronDelete: CalendarClock,
  CronList: CalendarClock,
  ScheduleWakeup: AlarmClock,
  RemoteTrigger: RadioTower,
  EnterWorktree: GitBranch,
  ExitWorktree: GitBranch,
  ListAgents: Bot,
  SendMessage: Send,
  Workflow: Workflow,
  ReportFindings: ClipboardCheck,
};

export const toolIcon = (name: string | null, mcp: boolean): IconSource =>
  mcp ? Unplug : ((name && TOOL_ICONS[name]) || Wrench);
