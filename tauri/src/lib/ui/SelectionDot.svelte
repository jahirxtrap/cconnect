<script lang="ts">
  interface Props {
    selected: boolean;
  }

  const { selected }: Props = $props();
</script>

<span
  class="flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors {selected
    ? 'border-accent'
    : 'border-outline'}"
>
  <span
    class="size-2.5 rounded-full bg-accent transition-transform {selected ? 'scale-100' : 'scale-0'}"
  ></span>
</span>
