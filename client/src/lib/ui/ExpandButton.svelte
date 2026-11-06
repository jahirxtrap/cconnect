<script lang="ts">
  import Maximize2 from "@lucide/svelte/icons/maximize-2";

  interface Props {
    label: string;
    onclick: () => void;
  }

  const { label, onclick }: Props = $props();
</script>

<button
  type="button"
  {onclick}
  aria-label={label}
  class="absolute top-2 right-2 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-float text-on-surface shadow-float opacity-90 transition-opacity hover:opacity-100"
>
  <Maximize2 size={16} />
</button>
