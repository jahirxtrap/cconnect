<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import Eraser from "@lucide/svelte/icons/eraser";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Pause from "@lucide/svelte/icons/pause";
  import Square from "@lucide/svelte/icons/square";
  import type { IconSource } from "$lib/ui/icons";
  import { hscrollbar } from "$lib/ui/scrollbar";

  interface Props {
    onKey: (bytes: number[]) => void;
  }

  const { onKey }: Props = $props();

  // ESC = 0x1b; arrows = ESC + "[A/B/C/D"; Ctrl+letter = letter - 64.
  const SOFT_KEYS: Array<{ label?: string; icon?: IconSource; title: string; bytes: number[] }> = [
    { label: "Esc", title: "Esc", bytes: [0x1b] },
    { label: "Tab", title: "Tab", bytes: [0x09] },
    { icon: ChevronUp, title: "↑", bytes: [0x1b, 0x5b, 0x41] },
    { icon: ChevronDown, title: "↓", bytes: [0x1b, 0x5b, 0x42] },
    { icon: ChevronLeft, title: "←", bytes: [0x1b, 0x5b, 0x44] },
    { icon: ChevronRight, title: "→", bytes: [0x1b, 0x5b, 0x43] },
    { icon: Square, title: "Ctrl+C", bytes: [0x03] },
    { icon: LogOut, title: "Ctrl+D", bytes: [0x04] },
    { icon: Eraser, title: "Ctrl+L", bytes: [0x0c] },
    { icon: Pause, title: "Ctrl+Z", bytes: [0x1a] },
    { label: "Home", title: "Home", bytes: [0x1b, 0x5b, 0x48] },
    { label: "End", title: "End", bytes: [0x1b, 0x5b, 0x46] },
  ];
</script>

<div use:hscrollbar={{ wheel: true }} class="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
  {#each SOFT_KEYS as key (key.title)}
    <button
      type="button"
      title={key.title}
      aria-label={key.title}
      onclick={() => onKey(key.bytes)}
      class="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full px-3 text-label-md text-on-surface-variant transition-colors hover:bg-on-surface/8"
    >
      {#if key.icon}
        {@const Icon = key.icon}
        <Icon size={16} />
      {:else}
        {key.label}
      {/if}
    </button>
  {/each}
</div>
