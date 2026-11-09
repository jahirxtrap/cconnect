import { shortcuts, type ShortcutScope } from "$lib/platform/shortcuts.svelte";
import { pageZoom } from "./pageZoom.svelte";

const CHANNEL = "cconnect-frame";
const SCOPES: ShortcutScope[] = ["preview", "global"];

interface FrameMessage {
  pinch?: unknown;
  keys?: unknown;
}

export function framePage(node: HTMLIFrameElement, zoomable: boolean) {
  if (!zoomable) return;
  const send = () => {
    void shortcuts.custom;
    const keys = shortcuts
      .available(SCOPES)
      .map((shortcut) => shortcuts.keys(shortcut.id))
      .filter(Boolean);
    node.contentWindow?.postMessage({ [CHANNEL]: { zoom: pageZoom.value, keys } }, "*");
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== node.contentWindow) return;
    const message = (event.data as Record<string, FrameMessage> | null)?.[CHANNEL];
    if (!message) return;
    if (typeof message.pinch === "number") pageZoom.wheel(message.pinch);
    if (typeof message.keys === "string") shortcuts.dispatch(message.keys, SCOPES);
  };

  $effect(send);
  node.addEventListener("load", send);
  window.addEventListener("message", onMessage);
  return {
    destroy() {
      node.removeEventListener("load", send);
      window.removeEventListener("message", onMessage);
    },
  };
}
