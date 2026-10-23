import type { ChatMessage } from "$lib/data/chatModels";
import type { ModComponent } from "$lib/data/modModels";

export const rowSite = (message: ChatMessage): ModComponent | null => {
  switch (message.role) {
    case "user":
      return "UserMessage";
    case "assistant":
      return message.ephemeral ? "CommandOutput" : "AssistantMessage";
    case "tool":
    case "file_change":
    case "agent":
      return "ToolUse";
    default:
      return null;
  }
};
