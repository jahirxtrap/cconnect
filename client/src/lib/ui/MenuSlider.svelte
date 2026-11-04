<script lang="ts">
  import type { IconSource } from "./icons";
  import { MENU_ICON_SIZE, menuIconClass } from "./menuSurface";
  import type { SelectOption } from "./SelectDialog.svelte";
  import Slider from "./Slider.svelte";

  interface Props {
    text: string;
    icon?: IconSource;
    options: SelectOption[];
    selected: string;
    onPick: (value: string) => void;
  }

  const { text, icon: IconComponent, options, selected, onPick }: Props = $props();

  const position = $derived(Math.max(0, options.findIndex((option) => option.value === selected)));
</script>

<div class="flex flex-col gap-1.5 px-2.5 pt-1.5 pb-2.5">
  <div class="flex min-h-5 items-center gap-2.5">
    {#if IconComponent}
      <IconComponent size={MENU_ICON_SIZE} class={menuIconClass()} />
    {/if}
    <span class="min-w-0 flex-1 truncate text-body-md">{text}</span>
    <span class="shrink-0 pl-4 text-caption text-faint">{options[position]?.label ?? ""}</span>
  </div>
  <Slider
    value={position}
    max={Math.max(0, options.length - 1)}
    showValue={false}
    onChange={(next) => {
      const option = options[next];
      if (option && option.value !== selected) onPick(option.value);
    }}
  />
</div>
