<script lang="ts">
  import Camera from "@lucide/svelte/icons/camera";
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import FolderSearch from "@lucide/svelte/icons/folder-search";
  import MonitorSmartphone from "@lucide/svelte/icons/monitor-smartphone";
  import PackagePlus from "@lucide/svelte/icons/package-plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import ScrollText from "@lucide/svelte/icons/scroll-text";
  import Smartphone from "@lucide/svelte/icons/smartphone";
  import Trash from "@lucide/svelte/icons/trash";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Upload from "@lucide/svelte/icons/upload";
  import { untrack } from "svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import {
    DEVICE_READY,
    deviceFailureText,
    deviceKindText,
    deviceStateText,
    type ApkSource,
    type DeviceInfo,
    type DevicesState,
    type EmulatorInfo,
    type SavedDevice,
  } from "$lib/data/deviceModels";
  import { formatSize, joined } from "$lib/data/format";
  import { KeyGate, keyRefused } from "$lib/data/keyGate.svelte";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { terminalTabs } from "$lib/data/terminalTabs.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { devices } from "$lib/services/devices.svelte";
  import { createDevicesApi, type DeviceOutcome } from "$lib/services/devicesApi";
  import { downloadUrl } from "$lib/services/sharedApi";
  import { downloadShared } from "$lib/services/sharedFiles";
  import { uploadAttachment } from "$lib/services/uploadApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ConnectionError from "$lib/ui/ConnectionError.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import DeviceScreen from "./DeviceScreen.svelte";
  import PairDialog from "./PairDialog.svelte";

  const LIST_FRAME = "flex-1 rounded-panel";
  const APK_TYPES = ".apk,application/vnd.android.package-archive";
  const APK_MENU = "apk";
  const PATH_SEPARATORS = /[\\/]/;

  const api = createDevicesApi(() => backend.active);
  const gate = new KeyGate();

  const fileName = (path: string) => path.split(PATH_SEPARATORS).at(-1) ?? path;

  let pairing = $state(false);
  let failed = $state<{ text: string; on: DevicesState | null } | null>(null);
  let busy = $state(false);
  let menuId = $state<string | null>(null);
  let forgetting = $state<SavedDevice | null>(null);
  let renaming = $state<DeviceInfo | null>(null);
  let unlocking = $state(false);
  let rejected = $state(false);
  let apkPicker = $state<HTMLInputElement | null>(null);
  let apkTarget: DeviceInfo | null = null;
  let browsing = $state(false);
  let choosing = $state<string | null>(null);

  const profile = $derived(backend.active);
  const snapshot = $derived(devices.stateOf(profile));
  const listed = $derived(snapshot !== null);
  const locked = $derived(securityKeys.unlocked(profile) === false);
  const opened = $derived(devices.openedOf(profile));
  const openedDevice = $derived(
    snapshot?.devices.find((device) => device.serial === opened && device.state === DEVICE_READY) ?? null,
  );
  const tools = $derived(snapshot?.tools ?? null);
  const ready = $derived(tools !== null && tools.missing.length === 0);
  const connected = $derived(snapshot?.devices ?? []);
  const usable = $derived(connected.filter((device) => device.state === DEVICE_READY));
  const failure = $derived(failed && failed.on === snapshot ? failed.text : null);
  const saved = $derived((snapshot?.saved ?? []).filter((entry) => !entry.connected));
  const emulators = $derived((snapshot?.emulators ?? []).filter((emulator) => !emulator.serial));
  const empty = $derived(!connected.length && !saved.length && !emulators.length);
  const toolsDetail = $derived(
    tools ? t(tools.missing.includes("adb") ? "DEVICES_TOOLS_DETAIL" : "DEVICES_TOOLS_DETAIL_SCRCPY", formatSize(tools.download)) : "",
  );

  $effect(() => {
    if (!snapshot && !serverStatus.unavailable) void devices.refresh(profile);
  });

  $effect(() => {
    if (listed && !locked) return devices.connect(profile);
  });

  $effect(() => {
    if (opened && snapshot && !openedDevice) untrack(() => devices.open(profile, null));
  });

  $effect(() =>
    openedDevice
      ? navigation.intercept(() => {
          devices.open(profile, null);
          return true;
        })
      : undefined,
  );

  const run = async <T,>(action: (key: string) => Promise<DeviceOutcome<T>>): Promise<T | null> => {
    failed = null;
    const result = await gate.run(action);
    if (result.ok) return result.value;
    if (!keyRefused(result)) failed = { text: deviceFailureText(result.failure), on: snapshot };
    return null;
  };

  const change = async (action: (key: string) => Promise<DeviceOutcome<DevicesState>>) => {
    const state = await run(action);
    if (state) devices.adopt(profile, state);
  };

  const askKey = () => {
    rejected = false;
    unlocking = true;
  };

  const unlocked = (action: () => void) => () => (locked ? askKey() : action());

  const unlock = async (key: string) => {
    if (!(await devices.refresh(profile, key))) {
      rejected = true;
      return;
    }
    securityKeys.set(key);
    unlocking = false;
    rejected = false;
  };

  const screenshot = async (device: DeviceInfo) => {
    menuId = null;
    busy = true;
    const path = await run((key) => api.screenshot(device.serial, key));
    busy = false;
    if (path) await downloadShared(downloadUrl(path, profile), fileName(path));
  };

  const logcat = async (device: DeviceInfo) => {
    menuId = null;
    const session = await run((key) => api.logcat(device.serial, key));
    if (!session) return;
    terminalTabs.openLocal(session);
    panes.show("terminal");
  };

  const pickApk = (source: ApkSource, device: DeviceInfo | null) => {
    menuId = null;
    apkTarget = device;
    if (source === "server") browsing = true;
    else apkPicker?.click();
  };

  const install = async (path: string, device: DeviceInfo) => {
    choosing = null;
    busy = true;
    await run((key) => api.install(device.serial, { project: null, path }, key));
    busy = false;
  };

  const deliver = (path: string) => {
    browsing = false;
    const target = apkTarget ?? (usable.length === 1 ? usable[0] : null);
    if (target) void install(path, target);
    else choosing = path;
  };

  const uploadApk = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    busy = true;
    failed = null;
    const path = await uploadAttachment(file, () => {}, profile);
    busy = false;
    if (path) deliver(path);
    else failed = { text: t("CONNECTION_ERROR"), on: snapshot };
  };

  const disconnect = (device: DeviceInfo) => {
    menuId = null;
    return change((key) => api.disconnect(device.serial, key));
  };

  const rename = (device: DeviceInfo, name: string) => {
    renaming = null;
    if (device.saved) return change((key) => api.rename(device.saved!, name, key));
  };

  const forget = (entry: SavedDevice) => {
    forgetting = null;
    return change((key) => api.forget(entry.id, key));
  };

  const subtitleOf = (device: DeviceInfo) =>
    joined(deviceStateText(device), device.android && t("DEVICE_ANDROID", device.android), deviceKindText(device.kind));

  const savedSubtitle = (entry: SavedDevice) =>
    joined(entry.model, t(entry.address ? "DEVICE_WIFI" : "DEVICE_USB"), t("DEVICE_NOT_CONNECTED"));

  const emulatorSubtitle = (emulator: EmulatorInfo) => joined(emulator.device, emulator.api !== null && t("DEVICE_API", emulator.api));
</script>

{#snippet apkSources(device: DeviceInfo | null)}
  <MenuItem icon={FolderSearch} text={t("DEVICE_APK_SERVER")} enabled={!busy} onclick={() => pickApk("server", device)} />
  <MenuItem icon={Upload} text={t("DEVICE_APK_LOCAL")} enabled={!busy} onclick={() => pickApk("local", device)} />
{/snippet}

{#snippet headerActions()}
  {#if ready}
    <TooltipIconButton label={t("DEVICE_PAIR")} onclick={unlocked(() => (pairing = true))}>
      <Plus />
    </TooltipIconButton>
  {/if}
  {#if ready && !locked && usable.length}
    <PopupMenu open={menuId === APK_MENU} onOpenChange={(open) => (menuId = open ? APK_MENU : null)} label={t("DEVICE_INSTALL_APK")} align="end">
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("DEVICE_INSTALL_APK")} tooltip={false} {...props}>
          <PackagePlus />
        </TooltipIconButton>
      {/snippet}
      {@render apkSources(null)}
    </PopupMenu>
  {/if}
{/snippet}

{#snippet unlockAction()}
  <ActionButton text={t("UNLOCK")} onclick={askKey} />
{/snippet}

{#snippet installAction()}
  <ActionButton icon={Download} text={t("INSTALL")} enabled={!tools?.installing} onclick={() => void change((key) => api.installTools(key))} />
{/snippet}

{#snippet pairAction()}
  <ActionButton text={t("DEVICE_PAIR")} onclick={() => (pairing = true)} />
{/snippet}

{#snippet deviceMenu(device: DeviceInfo)}
  <PopupMenu open={menuId === device.serial} onOpenChange={(open) => (menuId = open ? device.serial : null)} label={t("MORE_OPTIONS")} align="end">
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("MORE_OPTIONS")} tooltip={false} {...props}>
        <EllipsisVertical />
      </TooltipIconButton>
    {/snippet}
    <MenuItem icon={Camera} text={t("DEVICE_SCREENSHOT")} enabled={!busy} onclick={() => void screenshot(device)} />
    <MenuSub icon={PackagePlus} text={t("DEVICE_INSTALL_APK")} enabled={!busy}>
      {@render apkSources(device)}
    </MenuSub>
    <MenuItem icon={ScrollText} text={t("DEVICE_LOGCAT")} onclick={() => void logcat(device)} />
    {#if device.saved}
      <MenuItem icon={Pencil} text={t("RENAME")} onclick={() => (renaming = device)} />
    {/if}
    {#if device.kind !== "usb"}
      <MenuItem icon={Unplug} danger text={t("DISCONNECT")} onclick={() => void disconnect(device)} />
    {/if}
  </PopupMenu>
{/snippet}

<div class="relative flex h-full min-h-0 flex-col">
  {#if busy || tools?.installing}
    <LinearProgress class="absolute inset-x-0 top-0 z-30" />
  {/if}
  {#if openedDevice}
    {@const device = openedDevice}
    <DeviceScreen
      {device}
      {busy}
      onBack={() => devices.open(profile, null)}
      onScreenshot={() => void screenshot(device)}
      onInstall={(source) => pickApk(source, device)}
      onLogcat={() => void logcat(device)}
      onDisconnect={device.kind === "usb" ? null : () => void disconnect(device)}
    />
  {:else}
    <PaneHeader title={t("DEVICES")} actions={headerActions} />
    <div class="flex min-h-0 flex-1 flex-col gap-2 px-(--page-inset) pb-(--page-inset)">
      {#if failure}
        <ErrorText text={failure} class="shrink-0 px-1" />
      {:else if snapshot?.failure}
        <ErrorText text={deviceFailureText({ reason: "adb", detail: snapshot.failure })} class="shrink-0 px-1" />
      {/if}
      {#if serverStatus.unavailable}
        <ServerUnavailable class="min-h-0 flex-1" />
      {:else if !snapshot && !devices.failed(profile)}
        <CenteredProgress class="min-h-0 flex-1" />
      {:else if !snapshot}
        <ConnectionError class="min-h-0 flex-1" />
      {:else if locked}
        <EmptyState icon={Smartphone} text={t("DEVICES_LOCKED")} action={unlockAction} class="min-h-0 flex-1" />
      {:else if !ready}
        <EmptyState icon={Smartphone} text={t("DEVICES_TOOLS_MISSING")} detail={toolsDetail} action={installAction} class="min-h-0 flex-1" />
      {:else if empty}
        <EmptyState icon={Smartphone} text={t("DEVICES_NONE")} detail={t("DEVICES_NONE_DETAIL")} action={pairAction} class="min-h-0 flex-1" />
      {:else}
        <ScrollCard frame={LIST_FRAME} memory={`devices|${backend.activeId ?? ""}`}>
          <div class="flex flex-col p-1">
            {#if connected.length}
              <SectionHeader label={t("DEVICES_CONNECTED")} />
              {#each connected as device (device.serial)}
                {@const usable = device.state === DEVICE_READY}
                <ListRow
                  icon={device.kind === "emulator" ? MonitorSmartphone : Smartphone}
                  title={device.name}
                  subtitle={subtitleOf(device)}
                  subtitleLines={2}
                  dim={!usable}
                  onclick={usable ? () => devices.open(profile, device.serial) : undefined}
                >
                  {#snippet trailing()}
                    {#if usable}
                      {@render deviceMenu(device)}
                    {:else if device.kind === "emulator"}
                      <TooltipIconButton label={t("DISCONNECT")} onclick={() => void disconnect(device)}>
                        <Unplug />
                      </TooltipIconButton>
                    {/if}
                  {/snippet}
                </ListRow>
              {/each}
            {/if}
            {#if saved.length}
              <SectionHeader label={t("DEVICES_SAVED")} divider={connected.length > 0} />
              {#each saved as entry (entry.id)}
                <ListRow
                  icon={Smartphone}
                  title={entry.name}
                  subtitle={savedSubtitle(entry)}
                  dim={!entry.address}
                  onclick={entry.address ? () => void change((key) => api.connectSaved(entry.id, key)) : undefined}
                >
                  {#snippet trailing()}
                    <TooltipIconButton label={t("DEVICE_FORGET")} onclick={() => (forgetting = entry)}>
                      <Trash />
                    </TooltipIconButton>
                  {/snippet}
                </ListRow>
              {/each}
            {/if}
            {#if emulators.length}
              <SectionHeader label={t("DEVICES_EMULATORS")} divider={connected.length > 0 || saved.length > 0} />
              {#each emulators as emulator (emulator.name)}
                <ListRow
                  icon={MonitorSmartphone}
                  title={emulator.label}
                  subtitle={emulatorSubtitle(emulator)}
                  onclick={() => void change((key) => api.startEmulator(emulator.name, key))}
                >
                  {#snippet trailing()}
                    <TooltipIconButton label={t("START")} onclick={() => void change((key) => api.startEmulator(emulator.name, key))}>
                      <Play />
                    </TooltipIconButton>
                  {/snippet}
                </ListRow>
              {/each}
            {/if}
          </div>
        </ScrollCard>
      {/if}
    </div>
  {/if}
</div>

<input bind:this={apkPicker} type="file" accept={APK_TYPES} onchange={uploadApk} class="hidden" />

{#if browsing}
  <PathPickerDialog mode="file" onConfirm={deliver} onDismiss={() => (browsing = false)} />
{/if}

{#if choosing}
  {@const path = choosing}
  <CompactDialog title={t("DEVICE_INSTALL_APK")} subtitle={fileName(path)} onDismiss={() => (choosing = null)}>
    {#each usable as device (device.serial)}
      <DialogSelectItem label={device.name} subtitle={subtitleOf(device)} selected={false} onclick={() => void install(path, device)} />
    {/each}
  </CompactDialog>
{/if}

{#if pairing}
  <PairDialog {gate} {api} pairing={snapshot?.pairing ?? null} onDismiss={() => (pairing = false)} />
{/if}

{#if renaming}
  {@const device = renaming}
  <RenameDialog initial={device.name} onConfirm={(name) => void rename(device, name)} onDismiss={() => (renaming = null)} />
{/if}

{#if forgetting}
  {@const entry = forgetting}
  <ConfirmDialog
    title={t("DEVICE_FORGET")}
    text={t("DEVICE_FORGET_CONFIRM", entry.name)}
    confirmLabel={t("DEVICE_FORGET")}
    danger
    onConfirm={() => void forget(entry)}
    onDismiss={() => (forgetting = null)}
  />
{/if}

{#if gate.asking}
  <SecurityKeyDialog rejected={gate.rejected} onConfirm={(key) => gate.confirm(key)} onDismiss={() => gate.dismiss()} />
{/if}

{#if unlocking}
  <SecurityKeyDialog
    title={t("DEVICES_LOCKED")}
    {rejected}
    onConfirm={(key) => void unlock(key)}
    onDismiss={() => {
      unlocking = false;
      rejected = false;
    }}
  />
{/if}
