<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import ZoomIn from "@lucide/svelte/icons/zoom-in";
  import ZoomOut from "@lucide/svelte/icons/zoom-out";
  import { formatPercent } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "./MenuItem.svelte";
  import MenuSub from "./MenuSub.svelte";

  interface Props {
    zoom: number;
    shortcuts: { in: string; out: string; reset: string };
    onZoom: (step: number) => void;
    onReset: () => void;
  }

  const { zoom, shortcuts, onZoom, onReset }: Props = $props();
</script>

<MenuSub icon={ZoomIn} text={t("BROWSER_ZOOM")} value={formatPercent(zoom)}>
  <MenuItem
    icon={ZoomIn}
    text={t("BROWSER_ZOOM_IN")}
    shortcut={shortcuts.in}
    closeOnSelect={false}
    onclick={() => onZoom(1)}
  />
  <MenuItem
    icon={ZoomOut}
    text={t("BROWSER_ZOOM_OUT")}
    shortcut={shortcuts.out}
    closeOnSelect={false}
    onclick={() => onZoom(-1)}
  />
  <MenuItem
    icon={RotateCcw}
    text={t("RESET")}
    shortcut={shortcuts.reset}
    enabled={zoom !== 1}
    onclick={onReset}
  />
</MenuSub>
