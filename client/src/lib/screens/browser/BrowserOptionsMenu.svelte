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
    favorite: boolean;
    onFavorite: () => void;
    onClearSite: (() => void) | null;
    onClearAll: (() => void) | null;
  }

  const {
    url,
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
    favorite,
    onFavorite,
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
  const ICON = "shrink-0 text-on-surface-variant";

  let open = $state(false);

  const devices = $derived(native ? NATIVE_DEVICES : EMULATED_DEVICES);
  const current = $derived(devices.find((item) => item.name === device) ?? devices[0]);
</script>

<PopupMenu {open} label={t("MORE_OPTIONS")} onOpenChange={(value) => (open = value)}>
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("MORE_OPTIONS")} class={picking ? "size-8 text-accent" : "size-8"} {...props}>
      <EllipsisVertical size={18} />
    </TooltipIconButton>
  {/snippet}
  {#if onCapture}
    <MenuItem text={t("BROWSER_CAPTURE")} enabled={!!url} onclick={onCapture}>
      {#snippet leading()}<Paperclip size={20} class={ICON} />{/snippet}
    </MenuItem>
  {/if}
  <MenuItem text={t("OPEN_EXTERNALLY")} enabled={!!url} onclick={onOpen}>
    {#snippet leading()}<ExternalLink size={20} class={ICON} />{/snippet}
  </MenuItem>
  <MenuItem text={t("COPY_LINK")} enabled={!!url} onclick={onCopy}>
    {#snippet leading()}<ClipboardCopy size={20} class={ICON} />{/snippet}
  </MenuItem>
  <MenuItem
    text={t(favorite ? "BROWSER_FAVORITE_REMOVE" : "BROWSER_FAVORITE_ADD")}
    enabled={!!url}
    onclick={onFavorite}
  >
    {#snippet leading()}
      {#if favorite}
        <StarOff size={20} class={ICON} />
      {:else}
        <Star size={20} class={ICON} />
      {/if}
    {/snippet}
  </MenuItem>
  <MenuSub text={t("BROWSER_DEVICE")}>
    {#snippet leading()}<current.icon size={20} class={ICON} />{/snippet}
    {#each devices as item (item.name)}
      <MenuItem text={t(item.label)} selected={item.name === device} onclick={() => onDevice(item.name)}>
        {#snippet leading()}<item.icon size={20} class={ICON} />{/snippet}
      </MenuItem>
    {/each}
  </MenuSub>
  {#if zoom !== null}
    <MenuSub text={t("BROWSER_ZOOM")}>
      {#snippet leading()}<ZoomIn size={20} class={ICON} />{/snippet}
      <MenuItem text={t("BROWSER_ZOOM_IN")} shortcut="browser.zoom.in" closeOnSelect={false} onclick={() => onZoom(1)}>
        {#snippet leading()}<ZoomIn size={20} class={ICON} />{/snippet}
      </MenuItem>
      <MenuItem text={t("BROWSER_ZOOM_OUT")} shortcut="browser.zoom.out" closeOnSelect={false} onclick={() => onZoom(-1)}>
        {#snippet leading()}<ZoomOut size={20} class={ICON} />{/snippet}
      </MenuItem>
      <MenuItem text={t("RESET")} shortcut="browser.zoom.reset" enabled={zoom !== 1} onclick={onZoomReset}>
        {#snippet leading()}<RotateCcw size={20} class={ICON} />{/snippet}
      </MenuItem>
    </MenuSub>
  {/if}
  {#if onPick}
    <MenuItem text={t("BROWSER_PICK")} shortcut="browser.pick" selected={picking} onclick={onPick}>
      {#snippet leading()}<SquareMousePointer size={20} class={ICON} />{/snippet}
    </MenuItem>
  {/if}
  {#if onClearSite}
    <MenuItem text={t("BROWSER_SITE_CLEAR")} onclick={onClearSite}>
      {#snippet leading()}<Cookie size={20} class={ICON} />{/snippet}
    </MenuItem>
  {/if}
  {#if onClearAll}
    <MenuItem text={t("BROWSER_DATA_CLEAR_ALL")} onclick={onClearAll}>
      {#snippet leading()}<Trash size={20} class={ICON} />{/snippet}
    </MenuItem>
  {/if}
</PopupMenu>
