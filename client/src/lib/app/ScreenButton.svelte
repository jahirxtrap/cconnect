<script lang="ts">
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { IconSource } from "$lib/ui/icons";
  import { navigation, type Route } from "./navigation.svelte";

  interface Props {
    label: string;
    icon: IconSource;
    route?: Route;
    onclick: () => void;
  }

  const { label, icon: IconComponent, route, onclick }: Props = $props();

  const selected = $derived(route !== undefined && navigation.route === route);
</script>

<TooltipIconButton {label} {selected} {onclick}>
  <IconComponent />
</TooltipIconButton>
