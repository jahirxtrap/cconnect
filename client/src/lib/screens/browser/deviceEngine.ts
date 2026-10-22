import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isDesktop } from "$lib/platform";

interface AndroidBrowserBridge {
  call: (command: string, args: string) => string;
}

interface EngineMessage {
  event: string;
  payload: unknown;
}

const bridge = (): AndroidBrowserBridge | undefined =>
  (window as unknown as { AndroidBrowser?: AndroidBrowserBridge }).AndroidBrowser;

const handlers = new Map<string, (payload: unknown) => void>();

export const deviceBrowsing = isDesktop || !!bridge();

export const browserCall = <T = void>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
  const android = bridge();
  if (!android) return invoke<T>(command, args);
  try {
    return Promise.resolve(JSON.parse(android.call(command, JSON.stringify(args))) as T);
  } catch (error) {
    return Promise.reject(error);
  }
};

export const browserListen = <T>(event: string, handler: (payload: T) => void) => {
  if (!bridge()) {
    void listen<T>(event, (message) => handler(message.payload));
    return;
  }
  handlers.set(event, handler as (payload: unknown) => void);
  (window as unknown as { __cconnectBrowser?: (message: EngineMessage) => void }).__cconnectBrowser = (message) =>
    handlers.get(message.event)?.(message.payload);
};
