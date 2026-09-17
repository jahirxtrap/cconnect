<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Bot from "@lucide/svelte/icons/bot";
  import FilePen from "@lucide/svelte/icons/file-pen";
  import FolderSymlink from "@lucide/svelte/icons/folder-symlink";
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
    accent: boolean;
  }

  const spec = $derived.by<Spec>(() => {
    switch (message.role) {
      case "thinking":
        return { icon: Lightbulb, label: t("THINKING"), accent: false };
      case "tool":
        return { icon: SquareTerminal, label: message.toolName ?? "", accent: true };
      case "tool_result":
        return { icon: null, label: t("RESULT"), accent: false };
      case "summary":
        return { icon: null, label: t("SUMMARY"), accent: false };
      case "file_change":
        return { icon: FilePen, label: message.path ?? "", accent: true };
      case "shared":
        return { icon: FolderSymlink, label: plural("SHARED_COUNT", message.files?.length ?? 0), accent: false };
      case "compact":
        return { icon: Archive, label: t("COMPACTED"), accent: true };
      case "agent":
        return { icon: Bot, label: message.toolName ?? t("AGENT"), accent: true };
      case "interaction":
        return { icon: Lightbulb, label: t("PLAN"), accent: true };
      default:
        return { icon: null, label: "", accent: false };
    }
  });

  const tone = $derived(spec.accent ? "text-accent" : "text-on-surface-variant");
</script>

<div class="w-full bg-background shadow-sm">
  <CollapsibleHead
    label={spec.label}
    icon={spec.icon ?? undefined}
    labelClass={tone}
    iconClass={tone}
    expanded
    wide
    onclick={onCollapse}
  />
</div>
