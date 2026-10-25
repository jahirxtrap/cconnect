import type { ConnectionState } from "$lib/data/chatModels";

export interface LinkLook {
  dot: string;
  spinner: boolean;
  text: string;
}

export const LINK_LOOKS: Record<Exclude<ConnectionState, "connected">, LinkLook> = {
  disconnected: { dot: "bg-red", spinner: false, text: "SERVER_UNAVAILABLE" },
  connecting: { dot: "bg-gray", spinner: true, text: "CONNECTING" },
};
