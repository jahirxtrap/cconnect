<script lang="ts">
  import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
  import Cookie from "@lucide/svelte/icons/cookie";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Smartphone from "@lucide/svelte/icons/smartphone";
  import SquareMousePointer from "@lucide/svelte/icons/square-mouse-pointer";
  import Star from "@lucide/svelte/icons/star";
  import StarOff from "@lucide/svelte/icons/star-off";
  import Tablet from "@lucide/svelte/icons/tablet";
  import Trash from "@lucide/svelte/icons/trash";
  import ZoomIn from "@lucide/svelte/icons/zoom-in";
  import ZoomOut from "@lucide/svelte/icons/zoom-out";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { DESKTOP_SITE } from "./deviceBrowser.svelte";

  interface Props {
    url: string;
    favorite: boolean;
    onFavorite: () => void;
    device: string;
    native: boolean;
    onDevice: (name: string) => void;
    zoom: number | null;
    onZoom: (step: number) => void;
    onZoomReset: () => void;
    picking: boolean;
    onPick: (() => void) | null;
    onCapture: (() => void) | null;
    onOpen: () => void;
    onCopy: () => void;
    onClearSite: (() => void) | null;
    onClearAll: (() => void) | null;
  }

  const {
    url,
    favorite,
    onFavorite,
    device,
    native,
    onDevice,
    zoom,
    onZoom,
    onZoomReset,
    picking,
    onPick,
    onCapture,
    onOpen,
    onCopy,
    onClearSite,
    onClearAll,
  }: Props = $props();

  const NATIVE_DEVICES = [
    { name: "", label: "BROWSER_MOBILE", icon: Smartphone },
    { name: DESKTOP_SITE, label: "BROWSER_DESKTOP", icon: Monitor },
  ];
  const EMULATED_DEVICES = [
    { name: "", label: "BROWSER_RESPONSIVE", icon: Monitor },
    { name: "mobile", label: "BROWSER_MOBILE", icon: Smartphone },
    { name: "tablet", label: "BROWSER_TABLET", icon: Tablet },
  ];

  let open = $state(false);

  const devices = $derived(native ? NATIVE_DEVICES : EMULATED_DEVICES);
  const current = $derived(devices.find((item) => item.name === device) ?? devices[0]);
</script>

<PopupMenu {open} label={t("MORE_OPTIONS")} onOpenChange={(value) => (open = value)}>
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("MORE_OPTIONS")} active={picking} class="size-7" {...props}>
      <EllipsisVertical />
    </TooltipIconButton>
  {/snippet}
  {#if onCapture}
    <MenuItem icon={Paperclip} text={t("BROWSER_CAPTURE")} enabled={!!url} onclick={onCapture} />
  {/if}
  <MenuItem icon={ExternalLink} text={t("OPEN_EXTERNALLY")} enabled={!!url} onclick={onOpen} />
  <MenuItem icon={ClipboardCopy} text={t("COPY_LINK")} enabled={!!url} onclick={onCopy} />
  <MenuItem
    icon={favorite ? StarOff : Star}
    text={t(favorite ? "BROWSER_FAVORITE_REMOVE" : "BROWSER_FAVORITE_ADD")}
    enabled={!!url}
    onclick={onFavorite}
  />
  <MenuSub icon={current.icon} text={t("BROWSER_DEVICE")}>
    {#each devices as item (item.name)}
      <MenuItem
        icon={item.icon}
        text={t(item.label)}
        selected={item.name === device}
        onclick={() => onDevice(item.name)}
      />
    {/each}
  </MenuSub>
  {#if zoom !== null}
    <MenuSub icon={ZoomIn} text={t("BROWSER_ZOOM")}>
      <MenuItem
        icon={ZoomIn}
        text={t("BROWSER_ZOOM_IN")}
        shortcut="browser.zoom.in"
        closeOnSelect={false}
        onclick={() => onZoom(1)}
      />
      <MenuItem
        icon={ZoomOut}
        text={t("BROWSER_ZOOM_OUT")}
        shortcut="browser.zoom.out"
        closeOnSelect={false}
        onclick={() => onZoom(-1)}
      />
      <MenuItem
        icon={RotateCcw}
        text={t("RESET")}
        shortcut="browser.zoom.reset"
        enabled={zoom !== 1}
        onclick={onZoomReset}
      />
    </MenuSub>
  {/if}
  {#if onPick}
    <MenuItem
      icon={SquareMousePointer}
      text={t("BROWSER_PICK")}
      shortcut="browser.pick"
      selected={picking}
      onclick={onPick}
    />
  {/if}
  {#if onClearSite}
    <MenuItem icon={Cookie} danger text={t("BROWSER_SITE_CLEAR")} onclick={onClearSite} />
  {/if}
  {#if onClearAll}
    <MenuItem icon={Trash} danger text={t("BROWSER_DATA_CLEAR_ALL")} onclick={onClearAll} />
  {/if}
</PopupMenu>
