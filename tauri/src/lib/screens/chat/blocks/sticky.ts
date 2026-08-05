import type { ChatMessage } from "$lib/data/chatModels";

export const hasCollapsibleContent = (message: ChatMessage, labelMode: boolean): boolean => {
  const labelOnly = message.labelOnly || labelMode;
  switch (message.role) {
    case "thinking":
    case "tool_result":
    case "summary":
      return !labelOnly && message.text.trim().length > 0;
    case "tool":
      return message.text.trim().length > 0 || !!message.result?.trim();
    case "file_change":
      return !labelOnly && !!message.diffLines?.length;
    case "compact":
      return !!message.compact?.summary.trim();
    case "agent":
      return message.children.length > 0;
    case "interaction":
      return message.toolName === "ExitPlanMode";
    default:
      return false;
  }
};
