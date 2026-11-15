<script lang="ts" module>
  import type { IconSource } from "./icons";

  export interface SoftKey<T> {
    title: string;
    value: T;
    label?: string;
    icon?: IconSource;
    iconClass?: string;
  }
</script>

<script lang="ts" generics="T">
  import { HSCROLL_CLASS, hscrollbar } from "./scrollbar";

  interface Props {
    keys: SoftKey<T>[];
    onKey: (value: T) => void;
  }

  const { keys, onKey }: Props = $props();
</script>

<div use:hscrollbar={{ wheel: true }} class="{HSCROLL_CLASS} flex flex-1 gap-1 rounded-md">
  {#each keys as key (key.title)}
    <button
      type="button"
      title={key.title}
      aria-label={key.title}
      onclick={() => onKey(key.value)}
      class="ripple inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-surface-variant px-3 font-mono text-body-sm text-on-surface-variant transition-colors hover:text-on-surface"
    >
      {#if key.icon}
        {@const Icon = key.icon}
        <Icon size={16} class={key.iconClass ?? ""} />
      {:else}
        {key.label}
      {/if}
    </button>
  {/each}
</div>
