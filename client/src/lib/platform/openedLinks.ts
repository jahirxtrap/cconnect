import { isDesktop } from "$lib/platform";

const OPENED_EVENT = "opened-links";

type Host = { __cconnectOpenLink?: (link: string) => void };

const openedOnDesktop = async (handle: (link: string) => void) => {
  const [{ invoke }, { listen }] = await Promise.all([import("@tauri-apps/api/core"), import("@tauri-apps/api/event")]);
  const take = async () => (await invoke<string[]>("opened_links")).forEach(handle);
  await listen(OPENED_EVENT, () => void take());
  await take();
};

export const listenOpenedLinks = (handle: (link: string) => void) => {
  (window as unknown as Host).__cconnectOpenLink = handle;
  if (isDesktop) void openedOnDesktop(handle);
};
