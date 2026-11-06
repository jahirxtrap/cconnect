import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isTauri } from "$lib/platform";
import { backend, baseUrlOf } from "./backend.svelte";
import { createHttp } from "./http";
import { fetchBlob, sourceAction, type SourceOptions } from "./mediaSource";
import { fileHeaders, projectFileOf, projectFolderUrl } from "./projectFilesApi";
import { relativeFromUrl, sharedFolderUrl } from "./sharedApi";

interface PageOptions extends SourceOptions {
  name: string;
}

interface Page {
  src: string;
  sandbox: string;
  close: () => void;
}

const SCHEME = "preview";
const ISOLATED = "allow-scripts allow-forms allow-modals allow-downloads allow-popups allow-popups-to-escape-sandbox";
const OWN_ORIGIN = `${ISOLATED} allow-same-origin`;
export const HTML_TYPE = "text/html;charset=utf-8";

export const pageSandbox = ISOLATED;

const pageHtml = async (url: string, options: PageOptions) => {
  const file = await fetchBlob(url);
  return (options.transform ? await options.transform(file) : file).text();
};

const servedPage = async (url: string, name: string, html: string): Promise<Page | null> => {
  const profile = backend.sharedProfileOf(url);
  const shared = relativeFromUrl(url, profile);
  const source = shared === null ? projectFileOf(url, profile) : { path: shared, shared: true };
  if (!source) return null;
  const http = createHttp(
    () => profile,
    () => fileHeaders(url, profile),
  );
  const opened = await http.post<{ id: string }>("/pages", { entry: name, html, ...source });
  if (!opened?.id) return null;
  const route = `/pages/${encodeURIComponent(opened.id)}`;
  return {
    src: `${baseUrlOf(profile)}${route}/${encodeURIComponent(name)}`,
    sandbox: OWN_ORIGIN,
    close: () => void http.delete(route),
  };
};

const previewPage = async (url: string, name: string, html: string): Promise<Page> => {
  const id = crypto.randomUUID();
  const entry = encodeURIComponent(name);
  const assets = projectFolderUrl(url) ?? sharedFolderUrl(url) ?? "";
  await invoke("preview_open", { id, entry, html, assets, headers: fileHeaders(url, backend.sharedProfileOf(url)) });
  return {
    src: `${convertFileSrc("", SCHEME)}${id}/${entry}`,
    sandbox: OWN_ORIGIN,
    close: () => void invoke("preview_close", { id }).catch(() => undefined),
  };
};

const blobPage = (html: string): Page => {
  const src = URL.createObjectURL(new Blob([html], { type: HTML_TYPE }));
  return { src, sandbox: ISOLATED, close: () => URL.revokeObjectURL(src) };
};

const register = async (url: string, options: PageOptions): Promise<Page> => {
  const html = await pageHtml(url, options);
  const served = await servedPage(url, options.name, html);
  if (served) return served;
  return isTauri ? previewPage(url, options.name, html) : blobPage(html);
};

export function pageSrc(node: HTMLIFrameElement, options: PageOptions) {
  return sourceAction(
    options,
    register,
    (page) => {
      node.setAttribute("sandbox", page.sandbox);
      node.src = page.src;
    },
    (page) => page.close(),
  );
}
