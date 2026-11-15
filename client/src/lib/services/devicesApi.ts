import {
  toDeviceFailure,
  toDevicesState,
  toPairingOffer,
  type DeviceFailure,
  type DevicesState,
  type PairingOffer,
} from "$lib/data/deviceModels";
import { judgeKey } from "$lib/data/keyGate.svelte";
import { securityKeys } from "$lib/data/securityKeys.svelte";
import type { Profile } from "./backend.svelte";
import { createHttp, outcomeOf, type HttpResult, type Outcome } from "./http";
import type { TerminalInfo } from "./terminalApi";

type Wire = Record<string, unknown>;

export interface ApkSource {
  project: string | null;
  path: string;
}

export type DeviceOutcome<T> = Outcome<T, DeviceFailure>;

const outcome = <T>(result: HttpResult<Wire>, parse: (data: Wire) => T): DeviceOutcome<T> =>
  outcomeOf(result, parse, toDeviceFailure);

const segment = (id: string) => encodeURIComponent(id);

const pathOf = (data: Wire) => (typeof data.path === "string" ? data.path : "");

export const createDevicesApi = (profile: () => Profile) => {
  const keyed = (key: string) => createHttp(profile, () => securityKeys.headers(key));
  const device = (serial: string) => `/devices/${segment(serial)}`;
  const saved = (id: string) => `/devices/saved/${segment(id)}`;
  const changed = async (key: string, method: string, path: string, body?: unknown): Promise<DeviceOutcome<DevicesState>> =>
    outcome(await keyed(key).call<Wire>(method, path, undefined, body ?? {}), toDevicesState);

  return {
    async state(key: string): Promise<DeviceOutcome<DevicesState>> {
      const target = profile();
      const result = await keyed(key).call<Wire>("GET", "/devices");
      judgeKey(target, key, result);
      return outcome(result, toDevicesState);
    },

    installTools: (key: string) => changed(key, "POST", "/devices/tools/install"),

    async startPairing(key: string): Promise<DeviceOutcome<PairingOffer>> {
      return outcome(await keyed(key).call<Wire>("POST", "/devices/pairing", undefined, {}), toPairingOffer);
    },

    stopPairing: (key: string) => keyed(key).delete("/devices/pairing"),

    pair: (address: string, code: string, key: string) => changed(key, "POST", "/devices/pair", { address, code }),

    connect: (address: string, key: string) => changed(key, "POST", "/devices/connect", { address }),

    disconnect: (serial: string, key: string) => changed(key, "POST", `${device(serial)}/disconnect`),

    rename: (id: string, name: string, key: string) => changed(key, "PATCH", saved(id), { name }),

    forget: (id: string, key: string) => changed(key, "DELETE", saved(id)),

    connectSaved: (id: string, key: string) => changed(key, "POST", `${saved(id)}/connect`),

    startEmulator: (name: string, key: string) => changed(key, "POST", `/devices/emulators/${segment(name)}/start`),

    async screenshot(serial: string, key: string): Promise<DeviceOutcome<string>> {
      return outcome(await keyed(key).call<Wire>("POST", `${device(serial)}/screenshot`, undefined, {}), pathOf);
    },

    async install(serial: string, source: ApkSource, key: string): Promise<DeviceOutcome<string>> {
      return outcome(await keyed(key).call<Wire>("POST", `${device(serial)}/install`, undefined, source), (data) =>
        typeof data.output === "string" ? data.output : "",
      );
    },

    async logcat(serial: string, key: string): Promise<DeviceOutcome<TerminalInfo>> {
      return outcome(await keyed(key).call<Wire>("POST", `${device(serial)}/logcat`, undefined, {}), (data) => data as unknown as TerminalInfo);
    },
  };
};

export type DevicesApi = ReturnType<typeof createDevicesApi>;
