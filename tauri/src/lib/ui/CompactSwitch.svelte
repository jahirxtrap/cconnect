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
  onclick={(event) => event.stopPropagation()}
  class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[state=checked]:bg-accent data-[state=unchecked]:bg-outline-variant disabled:cursor-default disabled:opacity-40"
>
  <Switch.Thumb
    class="pointer-events-none block size-4 rounded-full bg-surface shadow-sm transition-transform data-[state=checked]:translate-x-4.5 data-[state=unchecked]:translate-x-0.5"
  />
</Switch.Root>
