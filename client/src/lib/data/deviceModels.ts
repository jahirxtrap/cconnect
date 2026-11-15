import { t } from "$lib/i18n/index.svelte";
import { flag, list, number, record, strings, text, type Wire } from "./wire";

export type DeviceKind = "usb" | "wifi" | "emulator";

export const DEVICE_READY = "device";
export const DEVICE_UNAUTHORIZED = "unauthorized";

export interface DeviceTools {
  adb: boolean;
  scrcpy: boolean;
  emulator: boolean;
  missing: string[];
  download: number;
  installing: boolean;
}

export interface DeviceInfo {
  serial: string;
  state: string;
  kind: DeviceKind;
  name: string;
  model: string;
  android: string;
  sdk: number | null;
  saved: string | null;
  avd: string | null;
  address: string | null;
}

export interface SavedDevice {
  id: string;
  serial: string;
  name: string;
  model: string;
  address: string | null;
  seenAt: number | null;
  connected: boolean;
}

export interface EmulatorInfo {
  name: string;
  label: string;
  device: string;
  api: number | null;
  serial: string | null;
}

export type PairingStatus = "waiting" | "pairing" | "paired" | "failed";

export interface PairingState {
  name: string;
  status: PairingStatus;
  detail: string;
  address: string;
}

export interface DevicesState {
  tools: DeviceTools;
  failure: string | null;
  devices: DeviceInfo[];
  saved: SavedDevice[];
  emulators: EmulatorInfo[];
  pairing: PairingState | null;
}

export interface PairingOffer {
  name: string;
  text: string;
}

export interface DeviceFailure {
  reason: string;
  detail: string;
}

export interface DeviceScreenState {
  running: boolean;
  name: string;
  width: number;
  height: number;
  codec: string;
  failure: string | null;
}

const KINDS: DeviceKind[] = ["usb", "wifi", "emulator"];

const PAIRING_STATUSES: PairingStatus[] = ["waiting", "pairing", "paired", "failed"];

const toDevice = (raw: Wire): DeviceInfo => ({
  serial: text(raw, "serial") ?? "",
  state: text(raw, "state") ?? "",
  kind: KINDS.find((kind) => kind === raw.kind) ?? "usb",
  name: text(raw, "name") ?? "",
  model: text(raw, "model") ?? "",
  android: text(raw, "android") ?? "",
  sdk: number(raw, "sdk"),
  saved: text(raw, "saved"),
  avd: text(raw, "avd"),
  address: text(raw, "address"),
});

const toSaved = (raw: Wire): SavedDevice => ({
  id: text(raw, "id") ?? "",
  serial: text(raw, "serial") ?? "",
  name: text(raw, "name") ?? "",
  model: text(raw, "model") ?? "",
  address: text(raw, "address"),
  seenAt: number(raw, "seen_at"),
  connected: flag(raw, "connected"),
});

const toEmulator = (raw: Wire): EmulatorInfo => ({
  name: text(raw, "name") ?? "",
  label: text(raw, "label") ?? "",
  device: text(raw, "device") ?? "",
  api: number(raw, "api"),
  serial: text(raw, "serial"),
});

const toPairing = (raw: Wire): PairingState | null => {
  const name = text(raw, "name");
  if (!name) return null;
  return {
    name,
    status: PAIRING_STATUSES.find((status) => status === raw.status) ?? "waiting",
    detail: text(raw, "detail") ?? "",
    address: text(raw, "address") ?? "",
  };
};

export const toDevicesState = (raw: Wire): DevicesState => {
  const tools = record(raw, "tools");
  return {
    tools: {
      adb: flag(tools, "adb"),
      scrcpy: flag(tools, "scrcpy"),
      emulator: flag(tools, "emulator"),
      missing: strings(tools, "missing"),
      download: number(tools, "download") ?? 0,
      installing: flag(tools, "installing"),
    },
    failure: text(raw, "failure"),
    devices: list(raw, "devices").map(toDevice),
    saved: list(raw, "saved").map(toSaved),
    emulators: list(raw, "emulators").map(toEmulator),
    pairing: toPairing(record(raw, "pairing")),
  };
};

export const toPairingOffer = (raw: Wire): PairingOffer => ({ name: text(raw, "name") ?? "", text: text(raw, "text") ?? "" });

export const toDeviceScreenState = (raw: Wire): DeviceScreenState => ({
  running: flag(raw, "running"),
  name: text(raw, "name") ?? "",
  width: number(raw, "width") ?? 0,
  height: number(raw, "height") ?? 0,
  codec: text(raw, "codec") ?? "",
  failure: text(raw, "failure"),
});

export const toDeviceFailure = (raw: unknown): DeviceFailure | null => {
  if (!raw || typeof raw !== "object") return null;
  const reason = text(raw as Wire, "reason");
  return reason ? { reason, detail: text(raw as Wire, "detail") ?? "" } : null;
};

const WITHOUT_DETAIL = new Set(["missing", "unauthorized", "offline", "booting", "tools"]);

const REASON_KEYS: Record<string, string> = {
  missing: "DEVICE_REASON_MISSING",
  invalid: "DEVICE_REASON_INVALID",
  pair: "DEVICE_REASON_PAIR",
  connect: "DEVICE_REASON_CONNECT",
  emulator: "DEVICE_REASON_EMULATOR",
  screenshot: "DEVICE_REASON_SCREENSHOT",
  screen: "DEVICE_REASON_SCREEN",
  tools: "DEVICE_REASON_TOOLS",
  install: "DEVICE_REASON_INSTALL",
  adb: "DEVICE_REASON_ADB",
  unauthorized: "DEVICE_UNAUTHORIZED",
  offline: "DEVICE_OFFLINE",
  booting: "DEVICE_BOOTING",
};

export const failureDetail = (detail: string): string => detail.trim().split("\n").at(-1)?.trim() ?? "";

export const deviceFailureText = (failure: DeviceFailure | null): string => {
  if (!failure) return t("CONNECTION_ERROR");
  const key = REASON_KEYS[failure.reason];
  const reason = key ? t(key) : null;
  return [reason, WITHOUT_DETAIL.has(failure.reason) ? "" : failureDetail(failure.detail)].filter(Boolean).join("\n");
};

const KIND_KEYS: Record<DeviceKind, string> = { usb: "DEVICE_USB", wifi: "DEVICE_WIFI", emulator: "DEVICE_EMULATOR" };

export const deviceKindText = (kind: DeviceKind): string => t(KIND_KEYS[kind]);

const STATE_KEYS: Record<string, string> = {
  [DEVICE_UNAUTHORIZED]: "DEVICE_UNAUTHORIZED",
  offline: "DEVICE_OFFLINE",
  booting: "DEVICE_BOOTING",
};

export const deviceStateText = (device: DeviceInfo): string | null =>
  device.state === DEVICE_READY ? null : t(STATE_KEYS[device.state] ?? "CONNECTING");
