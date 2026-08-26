<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Bot from "@lucide/svelte/icons/bot";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FilePen from "@lucide/svelte/icons/file-pen";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import type { ChatMessage } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import type { IconSource } from "$lib/ui/icons";

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
</script>

<div class="w-full bg-background shadow-sm">
  <!-- Pinned edge to edge over the list: a rounded hover would cut the band it sits on. -->
  <button
    type="button"
    onclick={onCollapse}
    class="flex w-full cursor-pointer items-center gap-[6px] px-4 text-left transition-colors select-none hover:bg-on-surface/8"
  >
    {#if spec.icon}
      <spec.icon size={16} class="shrink-0 {spec.accent ? 'text-accent' : 'text-on-surface-variant'}" />
    {/if}
    <span
      class="min-w-0 flex-1 truncate text-label-lg {spec.accent ? 'text-accent' : 'text-on-surface-variant'}"
    >
      {spec.label}
    </span>
    <ChevronDown size={18} class="shrink-0 text-on-surface-variant" />
  </button>
</div>
