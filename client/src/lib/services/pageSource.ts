import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isTauri } from "$lib/platform";
import { backend } from "./backend.svelte";
import { fetchFile, mediaSrc, sourceAction, type SourceOptions } from "./mediaSource";
import { fileHeaders, projectFolderUrl } from "./projectFilesApi";
import { sharedFolderUrl } from "./sharedApi";

interface PageOptions extends SourceOptions {
  name: string;
}

interface Page {
  id: string;
  src: string;
}

const SCHEME = "preview";
const ISOLATED = "allow-scripts allow-forms allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox";

export const pageSandbox = isTauri ? `${ISOLATED} allow-same-origin` : ISOLATED;

const register = async (url: string, options: PageOptions): Promise<Page> => {
  const response = await fetchFile(url);
  if (!response.ok) throw new Error(String(response.status));
  const file = await response.blob();
  const html = await (options.transform ? await options.transform(file) : file).text();
  const id = crypto.randomUUID();
  const entry = encodeURIComponent(options.name);
  const assets = projectFolderUrl(url) ?? sharedFolderUrl(url) ?? "";
  await invoke("preview_open", { id, entry, html, assets, headers: fileHeaders(url, backend.sharedProfileOf(url)) });
  return { id, src: `${convertFileSrc("", SCHEME)}${id}/${entry}` };
};

const close = (page: Page) => void invoke("preview_close", { id: page.id }).catch(() => undefined);

export function pageSrc(node: HTMLIFrameElement, options: PageOptions) {
  if (!isTauri) return mediaSrc(node, options);
  return sourceAction(
    options,
    register,
    (page) => {
      node.src = page.src;
    },
    close,
  );
}
