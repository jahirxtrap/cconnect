<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Bot from "@lucide/svelte/icons/bot";
  import FilePen from "@lucide/svelte/icons/file-pen";
  import FolderSymlink from "@lucide/svelte/icons/folder-symlink";
  import Inbox from "@lucide/svelte/icons/inbox";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import type { ChatMessage } from "$lib/data/chatModels";
  import { plural, t } from "$lib/i18n/index.svelte";
  import type { IconSource } from "$lib/ui/icons";
  import CollapsibleHead from "./CollapsibleHead.svelte";

  interface Props {
    message: ChatMessage;
    onCollapse: () => void;
  }

  const { message, onCollapse }: Props = $props();

  interface Spec {
    icon: IconSource | null;
    label: string;
    iconClass: string;
    labelClass: string;
  }

  const ACCENT = "text-accent";
  const MUTED = "text-on-surface-variant";

  const spec = $derived.by<Spec>(() => {
    switch (message.role) {
      case "thinking":
        return { icon: Lightbulb, label: t("THINKING"), iconClass: MUTED, labelClass: MUTED };
      case "tool":
        return { icon: SquareTerminal, label: message.toolName ?? t("TOOLS"), iconClass: ACCENT, labelClass: ACCENT };
      case "tool_result":
        return { icon: null, label: t("RESULT"), iconClass: MUTED, labelClass: MUTED };
      case "summary":
        return { icon: null, label: t("SUMMARY"), iconClass: MUTED, labelClass: MUTED };
      case "file_change":
        return { icon: FilePen, label: message.path ?? "", iconClass: ACCENT, labelClass: ACCENT };
      case "shared":
        return {
          icon: FolderSymlink,
          label: plural("SHARED_COUNT", message.files?.length ?? 0),
          iconClass: ACCENT,
          labelClass: MUTED,
        };
      case "compact":
        return { icon: Archive, label: t("COMPACTED"), iconClass: ACCENT, labelClass: ACCENT };
      case "agent":
        return { icon: Bot, label: message.toolName ?? t("AGENT"), iconClass: ACCENT, labelClass: ACCENT };
      case "agent_report":
        return { icon: Bot, label: message.toolName || t("AGENT_REPORT"), iconClass: ACCENT, labelClass: ACCENT };
      case "session_message":
        return { icon: Inbox, label: message.toolName || t("SESSION_MESSAGE"), iconClass: ACCENT, labelClass: ACCENT };
      case "plan":
      case "interaction":
        return { icon: Lightbulb, label: t("PLAN"), iconClass: ACCENT, labelClass: ACCENT };
      default:
        return { icon: null, label: "", iconClass: MUTED, labelClass: MUTED };
    }
  });
</script>

<div class="w-full bg-background shadow-sm">
  <CollapsibleHead
    label={spec.label}
    icon={spec.icon ?? undefined}
    labelClass={spec.labelClass}
    iconClass={spec.iconClass}
    expanded
    wide
    onclick={onCollapse}
  />
</div>
