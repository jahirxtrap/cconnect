<script lang="ts">
  import { Switch } from "bits-ui";

  interface Props {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    enabled?: boolean;
  }

  const { checked, onCheckedChange, enabled = true }: Props = $props();
</script>

<Switch.Root
  {checked}
  {onCheckedChange}
  disabled={!enabled}
  class="inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=unchecked]:border-on-surface-variant data-[state=unchecked]:bg-transparent disabled:cursor-default disabled:opacity-40"
>
  <Switch.Thumb
    class="pointer-events-none block size-3 rounded-full transition-transform data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-on-accent data-[state=unchecked]:translate-x-[2px] data-[state=unchecked]:bg-on-surface-variant"
  />
</Switch.Root>
