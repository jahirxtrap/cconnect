<script lang="ts">
  import Monitor from "@lucide/svelte/icons/monitor";
  import Smartphone from "@lucide/svelte/icons/smartphone";
  import Tablet from "@lucide/svelte/icons/tablet";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    device: string;
    onSelect: (name: string) => void;
  }

  const { device, onSelect }: Props = $props();

  const DEVICES = [
    { name: "", label: "BROWSER_RESPONSIVE", icon: Monitor },
    { name: "mobile", label: "BROWSER_MOBILE", icon: Smartphone },
    { name: "tablet", label: "BROWSER_TABLET", icon: Tablet },
  ];

  let menu = $state(false);

  const current = $derived(DEVICES.find((item) => item.name === device) ?? DEVICES[0]);
</script>

<PopupMenu
  open={menu}
  onOpenChange={(value) => (menu = value)}
  label={t("BROWSER_DEVICE")}
  align="end"
>
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("BROWSER_DEVICE")} class="size-8" {...props}>
      <current.icon size={18} />
    </TooltipIconButton>
  {/snippet}
  {#each DEVICES as item (item.name)}
    <MenuItem text={t(item.label)} onclick={() => onSelect(item.name)}>
      {#snippet leading()}
        <item.icon
          size={20}
          class="shrink-0 {device === item.name ? 'text-accent' : 'text-on-surface-variant'}"
        />
      {/snippet}
    </MenuItem>
  {/each}
</PopupMenu>
