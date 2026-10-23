import type { ChatMessage } from "$lib/data/chatModels";
import { joined } from "$lib/data/format";
import { plural } from "$lib/i18n/index.svelte";

export type ToolRunKind = "reads" | "searches" | "listings";

export interface ToolRun {
  id: string;
  anchor: number;
  members: number[];
  calls: ChatMessage[];
}

const FOLDED: Record<string, ToolRunKind> = { Read: "reads", Grep: "searches", Glob: "searches", LS: "listings" };

const KIND_LABELS: Record<ToolRunKind, string> = {
  reads: "TOOL_GROUP_READS",
  searches: "TOOL_GROUP_SEARCHES",
  listings: "TOOL_GROUP_LISTINGS",
};

const foldedKind = (message: ChatMessage): ToolRunKind | null =>
  message.role === "tool" && message.toolName ? (FOLDED[message.toolName] ?? null) : null;

const runOf = (members: ChatMessage[]): ToolRun => {
  const calls = members.filter((member) => member.role === "tool");
  return {
    id: `group:${calls[0].toolUseId ?? calls[0].id}`,
    anchor: members[0].id,
    members: members.map((member) => member.id),
    calls,
  };
};

export const toolRuns = (messages: ChatMessage[]): ToolRun[] => {
  const runs: ToolRun[] = [];
  let current: ChatMessage[] = [];
  let between: ChatMessage[] = [];
  const close = () => {
    if (current.length) runs.push(runOf(current));
    current = [];
    between = [];
  };
  for (const message of messages) {
    if (foldedKind(message)) {
      current.push(...between, message);
      between = [];
    } else if (message.role === "thinking" && current.length) {
      between.push(message);
    } else if (message.role === "tool_result" && current.some((call) => call.toolUseId === message.toolUseId)) {
      current.push(...between, message);
      between = [];
    } else {
      close();
    }
  }
  close();
  return runs;
};

export const runSummary = (run: ToolRun): string => {
  const counts = new Map<ToolRunKind, number>();
  for (const call of run.calls) {
    const kind = foldedKind(call);
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return joined(...[...counts].map(([kind, count]) => plural(KIND_LABELS[kind], count, count)));
};
