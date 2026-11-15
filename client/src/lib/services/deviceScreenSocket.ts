import { toDeviceFailure, toDeviceScreenState, type DeviceFailure, type DeviceScreenState } from "$lib/data/deviceModels";
import { videoDecodable, type StreamInfo } from "$lib/ui/frameSurface";
import type { Profile } from "./backend.svelte";
import { ReconnectingSocket } from "./socket";

export interface ScreenViewport {
  width: number;
  height: number;
}

export interface TouchPoint {
  action: "down" | "up" | "move" | "cancel";
  pointer: number;
  x: number;
  y: number;
}

export interface ScrollStep {
  x: number;
  y: number;
  horizontal: number;
  vertical: number;
}

export interface KeyPress {
  name: string;
  action: "down" | "up";
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
}

export interface DeviceScreenHooks {
  onFrame: (buffer: ArrayBuffer) => void;
  onStream: (info: StreamInfo) => void;
  onState: (state: DeviceScreenState) => void;
  onError: (failure: DeviceFailure | null) => void;
  onConnected: (value: boolean) => void;
}

export interface DeviceScreenLink {
  touch: (point: TouchPoint) => void;
  scroll: (step: ScrollStep) => void;
  key: (press: KeyPress) => void;
  press: (name: string) => void;
  text: (value: string) => void;
  display: (on: boolean) => void;
  rotate: () => void;
  keyframe: () => void;
  close: () => void;
}

export const deviceScreenLink = (
  profile: Profile,
  serial: string,
  key: string,
  hooks: DeviceScreenHooks,
  viewport: () => ScreenViewport,
): DeviceScreenLink => {
  const socket = new ReconnectingSocket(
    `/devices/${encodeURIComponent(serial)}/screen`,
    {
      onOpen: () => socket.send({ key, video: videoDecodable, ...viewport() }),
      onBinary: hooks.onFrame,
      onMessage: (data) => {
        if (data.type === "stream") {
          hooks.onStream({
            codec: (data.codec as string) ?? "",
            width: (data.width as number) ?? 0,
            height: (data.height as number) ?? 0,
          });
        } else if (data.type === "state") {
          hooks.onConnected(true);
          hooks.onState(toDeviceScreenState(data));
        } else if (data.type === "error") {
          hooks.onError(toDeviceFailure(data));
        }
      },
      onDrop: () => hooks.onConnected(false),
    },
    () => profile,
  );
  socket.connect();

  const post = (payload: Record<string, unknown>) => socket.send(payload);

  return {
    touch: (point) => post({ type: "touch", ...point }),
    scroll: (step) => post({ type: "scroll", ...step }),
    key: (press) => post({ type: "key", ...press }),
    press: (name) => post({ type: "press", name }),
    text: (value) => post({ type: "text", value }),
    display: (on) => post({ type: "display", on }),
    rotate: () => post({ type: "rotate" }),
    keyframe: () => post({ type: "keyframe" }),
    close: () => socket.close(),
  };
};
