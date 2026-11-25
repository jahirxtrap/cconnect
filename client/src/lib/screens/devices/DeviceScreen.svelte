<script lang="ts">
  import Camera from "@lucide/svelte/icons/camera";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import Moon from "@lucide/svelte/icons/moon";
  import PackagePlus from "@lucide/svelte/icons/package-plus";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import ScrollText from "@lucide/svelte/icons/scroll-text";
  import Smartphone from "@lucide/svelte/icons/smartphone";
  import Sun from "@lucide/svelte/icons/sun";
  import Unplug from "@lucide/svelte/icons/unplug";
  import { deviceFailureText, type DeviceInfo, type DeviceScreenState } from "$lib/data/deviceModels";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { deviceScreenLink, type DeviceScreenLink } from "$lib/services/deviceScreenSocket";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { framePainter, type FramePainter } from "$lib/ui/framePainter";
  import { keepStill, takeStill } from "$lib/ui/frameStills";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import SoftKeys from "$lib/ui/SoftKeys.svelte";
  import { SURFACE_FRAME_CLASS, SURFACE_KEYS_CLASS } from "$lib/ui/surfaceFrame";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { deviceKeys, TYPED_KEYS } from "./deviceKeys";

  interface Props {
    device: DeviceInfo;
    busy: boolean;
    onBack: () => void;
    onScreenshot: () => void;
    onInstall: () => void;
    onLogcat: () => void;
    onDisconnect: (() => void) | null;
  }

  const { device, busy, onBack, onScreenshot, onInstall, onLogcat, onDisconnect }: Props = $props();

  const BACK_BUTTON = 2;
  const PRIMARY_BUTTON = 0;

  let surface = $state<HTMLDivElement | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let typer = $state<HTMLInputElement | null>(null);
  let painter: FramePainter | null = null;
  let link: DeviceScreenLink | null = null;
  let keep: (() => void) | null = null;
  let ready = $state(false);
  let connected = $state(false);
  let dropped = $state(false);
  let failed = $state<string | null>(null);
  let screen = $state<DeviceScreenState | null>(null);
  let displayOff = $state(false);
  let menuOpen = $state(false);

  const keys = $derived(deviceKeys());
  const serial = $derived(device.serial);
  const pointers = new Map<number, number>();

  const viewport = () => {
    const scale = window.devicePixelRatio || 1;
    return { width: Math.round((surface?.clientWidth ?? 0) * scale), height: Math.round((surface?.clientHeight ?? 0) * scale) };
  };

  $effect(() => {
    if (!canvas) return;
    const created = framePainter(
      canvas,
      () => (ready = true),
      () => link?.keyframe(),
    );
    painter = created;
    return () => {
      keep?.();
      created.close();
      painter = null;
    };
  });

  $effect(() => {
    const target = serial;
    const profile = backend.active;
    const key = securityKeys.keyFor(profile);
    if (!surface) return;
    const still = `device|${profile?.id ?? ""}|${target}`;
    let live = true;
    ready = false;
    failed = null;
    const created = deviceScreenLink(
      profile,
      target,
      key,
      {
        onFrame: (buffer) => painter?.frame(buffer),
        onStream: (info) => painter?.stream(info),
        onState: (state) => {
          screen = state;
          if (state.failure) failed = deviceFailureText({ reason: "screen", detail: state.failure });
        },
        onError: (failure) => (failed = deviceFailureText(failure)),
        onConnected: (value) => {
          connected = value;
          dropped = !value;
          if (value) return;
          ready = false;
          painter?.rearm();
        },
      },
      viewport,
    );
    link = created;
    void takeStill(still).then((frame) => {
      if (frame && live && !ready) painter?.frame(frame);
    });
    keep = () => {
      keep = null;
      if (ready && painter) keepStill(still, painter);
    };
    return () => {
      keep?.();
      live = false;
      created.close();
      link = null;
      ready = false;
      connected = false;
      dropped = false;
      screen = null;
      displayOff = false;
      painter?.rearm();
    };
  });

  const slotOf = (id: number) => {
    const known = pointers.get(id);
    if (known !== undefined) return known;
    const taken = new Set(pointers.values());
    let slot = 0;
    while (taken.has(slot)) slot++;
    pointers.set(id, slot);
    return slot;
  };

  const spot = (event: PointerEvent | WheelEvent) => {
    const box = canvas?.getBoundingClientRect();
    if (!box || !screen || !box.width || !box.height) return null;
    return {
      x: Math.round(((event.clientX - box.left) / box.width) * screen.width),
      y: Math.round(((event.clientY - box.top) / box.height) * screen.height),
    };
  };

  const touch = (event: PointerEvent, action: "down" | "up" | "move" | "cancel") => {
    const point = spot(event);
    if (!point) return;
    link?.touch({ action, pointer: slotOf(event.pointerId), ...point });
  };

  const press = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button === BACK_BUTTON) {
      link?.press("back");
      return;
    }
    if (event.pointerType === "mouse" && event.button !== PRIMARY_BUTTON) return;
    if (!isTouch || !typer || document.activeElement !== typer) canvas?.focus();
    canvas?.setPointerCapture(event.pointerId);
    touch(event, "down");
  };

  const move = (event: PointerEvent) => {
    if (pointers.has(event.pointerId)) touch(event, "move");
  };

  const release = (event: PointerEvent, action: "up" | "cancel") => {
    if (!pointers.has(event.pointerId)) return;
    touch(event, action);
    pointers.delete(event.pointerId);
  };

  const onwheel = (event: WheelEvent) => {
    event.preventDefault();
    const point = spot(event);
    if (!point) return;
    link?.scroll({ ...point, horizontal: Math.sign(event.deltaX), vertical: -Math.sign(event.deltaY) });
  };

  const modifiers = (event: KeyboardEvent) => ({ shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey });

  const typed = (event: KeyboardEvent, action: "down" | "up") => {
    if (!TYPED_KEYS.has(event.key)) return false;
    event.preventDefault();
    link?.key({ name: event.key, action, ...modifiers(event) });
    return true;
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (typed(event, "down")) return;
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      link?.text(event.key);
    }
  };

  const onkeyup = (event: KeyboardEvent) => {
    typed(event, "up");
  };

  const typerInput = () => {
    if (!typer) return;
    const value = typer.value;
    typer.value = "";
    if (value) link?.text(value);
  };

  const toggleKeyboard = () => {
    if (!typer) return;
    if (document.activeElement === typer) typer.blur();
    else typer.focus();
  };

  const toggleDisplay = () => {
    menuOpen = false;
    displayOff = !displayOff;
    link?.display(!displayOff);
  };

  const rotate = () => {
    menuOpen = false;
    link?.rotate();
  };

  const picked = (action: () => void) => () => {
    menuOpen = false;
    action();
  };
</script>

{#snippet actions()}
  <TooltipIconButton label={t("DEVICE_SCREENSHOT")} enabled={!busy} onclick={onScreenshot}>
    <Camera />
  </TooltipIconButton>
  <PopupMenu open={menuOpen} onOpenChange={(open) => (menuOpen = open)} label={t("MORE_OPTIONS")} align="end">
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("MORE_OPTIONS")} tooltip={false} {...props}>
        <EllipsisVertical />
      </TooltipIconButton>
    {/snippet}
    <MenuItem icon={RotateCw} text={t("DEVICE_ROTATE")} enabled={ready} onclick={rotate} />
    <MenuItem icon={PackagePlus} text={t("DEVICE_INSTALL_APK")} enabled={!busy} onclick={picked(onInstall)} />
    <MenuItem icon={ScrollText} text={t("DEVICE_LOGCAT")} onclick={picked(onLogcat)} />
    <MenuItem icon={displayOff ? Sun : Moon} text={t(displayOff ? "DEVICE_SCREEN_ON" : "DEVICE_SCREEN_OFF")} enabled={ready} onclick={toggleDisplay} />
    {#if onDisconnect}
      <MenuItem icon={Unplug} danger text={t("DISCONNECT")} onclick={picked(onDisconnect)} />
    {/if}
  </PopupMenu>
{/snippet}

<PaneHeader title={device.name} {onBack} {actions} />
<div bind:this={surface} class="{SURFACE_FRAME_CLASS} relative flex min-h-0 flex-1 items-center justify-center bg-background">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <canvas
    bind:this={canvas}
    tabindex="0"
    class="max-h-full max-w-full touch-none bg-background outline-none {ready ? '' : 'invisible'}"
    onpointerdown={press}
    onpointermove={move}
    onpointerup={(event) => release(event, "up")}
    onpointercancel={(event) => release(event, "cancel")}
    oncontextmenu={(event) => event.preventDefault()}
    {onwheel}
    {onkeydown}
    {onkeyup}
  ></canvas>
  <input
    bind:this={typer}
    type="text"
    tabindex="-1"
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck={false}
    class="pointer-events-none absolute bottom-0 left-0 size-px opacity-0"
    oninput={typerInput}
    onkeydown={(event) => typed(event, "down")}
    onkeyup={onkeyup}
  />
  {#if serverStatus.unavailable}
    <ServerUnavailable class="absolute inset-0 bg-background" />
  {:else if failed}
    <EmptyState icon={Smartphone} text={failed} class="absolute inset-0 bg-background" />
  {:else if !ready && !connected}
    <EmptyState loading={!dropped} icon={Smartphone} text={t("CONNECTION_ERROR")} class="absolute inset-0 bg-background" />
  {:else if !ready}
    <CenteredProgress class="absolute inset-0 bg-background" />
  {/if}
</div>
<div class={SURFACE_KEYS_CLASS}>
  <SoftKeys {keys} onKey={(name) => link?.press(name)} />
  {#if isTouch}
    <TooltipIconButton label={t("KEYBOARD")} tooltip={false} class="size-8" onclick={toggleKeyboard}>
      <Keyboard />
    </TooltipIconButton>
  {/if}
</div>
