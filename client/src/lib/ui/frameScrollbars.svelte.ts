import scrollbarRules from "$lib/design/scrollbars.css?raw";
import { theme } from "$lib/design/theme.svelte";

const MARK = "data-cconnect-scrollbars";
const ANCHORS = [/<head\b[^>]*>/i, /<!doctype[^>]*>/i];
const OWN_STYLE = /::-webkit-scrollbar|scrollbar-(color|width)/;
const LISTENER = `addEventListener("message",(event)=>{const text=event.source===parent&&event.data&&event.data[${JSON.stringify(MARK)}];const style=document.querySelector("style[${MARK}]");if(typeof text==="string"&&style)style.textContent=text})`;

const sheet = () => {
  const { scrollbar, "scrollbar-hover": hover } = theme.current.colors;
  return `:root{--c-scrollbar:${scrollbar};--c-scrollbar-hover:${hover}}${scrollbarRules}`;
};

const stylesScrollbars = (page: Document) =>
  [...page.querySelectorAll("style, [style]")].some((node) =>
    OWN_STYLE.test(node instanceof HTMLStyleElement ? (node.textContent ?? "") : (node.getAttribute("style") ?? "")),
  );

export const themedPage = async (file: Blob): Promise<Blob> => {
  const html = await file.text();
  if (stylesScrollbars(new DOMParser().parseFromString(html, "text/html"))) return file;
  const anchor = ANCHORS.map((pattern) => html.match(pattern)).find((match) => match !== null);
  const at = anchor ? anchor.index! + anchor[0].length : 0;
  const style = `<style ${MARK}>${sheet()}</style><script ${MARK}>${LISTENER}</script>`;
  return new Blob([html.slice(0, at), style, html.slice(at)], { type: "text/html;charset=utf-8" });
};

export function frameScrollbars(node: HTMLIFrameElement) {
  $effect(() => {
    node.contentWindow?.postMessage({ [MARK]: sheet() }, "*");
  });
}
