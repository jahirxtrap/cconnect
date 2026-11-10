const OFFSCREEN = "offscreen.html";

const offscreenOpen = async () => {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts.length) return true;
  await chrome.offscreen.createDocument({ url: OFFSCREEN, reasons: ["USER_MEDIA"], justification: "Streams the active tab to the CConnect app" });
  return true;
};

globalThis.__capture = async (options) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error("no active tab");
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  await offscreenOpen();
  return chrome.runtime.sendMessage({ op: "capture", streamId, ...options });
};

globalThis.__stop = async () => {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts.length) await chrome.runtime.sendMessage({ op: "stop" });
};
