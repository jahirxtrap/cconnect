<script lang="ts">
  import type { IconSource } from "./icons";
  import Pressable from "./Pressable.svelte";

  interface Props {
    label: string;
    icon: IconSource;
    current: boolean;
    onclick: () => void;
  }

  const { label, icon: Icon, current, onclick }: Props = $props();
</script>

<Pressable
  {onclick}
  hover={!current}
  class="flex h-8 w-full shrink-0 items-center gap-2 rounded-md px-2.5 text-body-md {current
    ? 'bg-surface-variant text-on-surface'
    : 'text-on-surface-variant'}"
>
  <Icon size={16} class="shrink-0 {current ? 'text-accent' : ''}" />
  <span class="min-w-0 flex-1 truncate text-left">{label}</span>
</Pressable>
