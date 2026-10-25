import { decodeBase64 } from "$lib/data/base64";
import { isDesktop } from "$lib/platform";

interface NativeFile {
  name: string;
  mime: string;
  data: string;
}

type Host = { __cconnectPaste?: (payload: string) => void };

type Route = (files: File[]) => Promise<File[]>;

const OPENED_EVENT = "opened-files";

const decoded = (items: NativeFile[]): File[] =>
  items.map((item) => new File([decodeBase64(item.data)], item.name, { type: item.mime }));

let attach: ((files: File[]) => void) | null = null;
let waiting: File[] = [];

const deliver = (files: File[]) => {
  if (!files.length) return;
  if (attach) attach(files);
  else waiting = [...waiting, ...files];
};

const openedOnDesktop = async (route: Route) => {
  const [{ invoke }, { listen }] = await Promise.all([import("@tauri-apps/api/core"), import("@tauri-apps/api/event")]);
  const take = async () => deliver(await route(decoded(await invoke<NativeFile[]>("opened_files"))));
  await listen(OPENED_EVENT, () => void take());
  await take();
};

export const listenNativeFiles = (route: Route) => {
  (window as unknown as Host).__cconnectPaste = (payload) => {
    let items: NativeFile[];
    try {
      items = JSON.parse(payload) as NativeFile[];
    } catch {
      return;
    }
    void route(decoded(items)).then(deliver);
  };
  if (isDesktop) void openedOnDesktop(route);
};

export const onNativePaste = (handler: (files: File[]) => void): (() => void) => {
  attach = handler;
  const held = waiting;
  waiting = [];
  if (held.length) handler(held);
  return () => {
    if (attach === handler) attach = null;
  };
};
