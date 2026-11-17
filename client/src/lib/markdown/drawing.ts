import DOMPurify, { type Config } from "dompurify";
import type { Profile } from "$lib/services/backend.svelte";

export interface DrawingSource {
  svg: () => string;
  server: Profile;
  folder: string;
}

const OUTSIDE = /url\(\s*['"]?\s*(?!#)|@import/i;
const EXPORT_SCALE = 2;
const IMAGE_TYPE = "image/png";
const VECTOR_TYPE = "image/svg+xml";
const REFERENCE = /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g;
const PIXELS = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/;
const LINKS = new Set(["href", "xlink:href"]);

const purifier = DOMPurify(window);

purifier.addHook("uponSanitizeAttribute", (_node, data) => {
  data.keepAttr = LINKS.has(data.attrName) ? data.attrValue.trim().startsWith("#") : !OUTSIDE.test(data.attrValue);
});

const SANITIZE: Config & { RETURN_DOM_FRAGMENT: true } = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ["use"],
  FORBID_TAGS: ["a", "image", "style"],
  RETURN_DOM_FRAGMENT: true,
};

let drawn = 0;

const scoped = (svg: SVGSVGElement) => {
  const prefix = `drawing-${++drawn}-`;
  const ids = new Set<string>();
  for (const node of svg.querySelectorAll("[id]")) {
    ids.add(node.id);
    node.id = `${prefix}${node.id}`;
  }
  if (!ids.size) return;
  const renamed = (value: string) =>
    value.replace(REFERENCE, (whole, _quote: string, id: string) => (ids.has(id) ? `url(#${prefix}${id})` : whole));
  for (const node of [svg, ...svg.querySelectorAll("*")]) {
    for (const attribute of node.attributes) {
      const target = attribute.value.trim().slice(1);
      const value = LINKS.has(attribute.name)
        ? ids.has(target)
          ? `#${prefix}${target}`
          : attribute.value
        : renamed(attribute.value);
      if (value !== attribute.value) attribute.value = value;
    }
  }
};

const pixels = (value: string | null) => Number(PIXELS.exec(value ?? "")?.[1] ?? 0);

const framed = (svg: SVGSVGElement) => {
  if (!svg.getClientRects().length) return;
  const view = svg.viewBox.baseVal;
  const width = pixels(svg.getAttribute("width")) || view?.width || 0;
  const height = pixels(svg.getAttribute("height")) || view?.height || 0;
  const base = view?.width && view.height ? view : { x: 0, y: 0, width, height };
  const box = svg.getBBox();
  const left = Math.min(base.x, box.x);
  const top = Math.min(base.y, box.y);
  const right = Math.max(base.x + base.width, box.x + box.width);
  const bottom = Math.max(base.y + base.height, box.y + box.height);
  if (right <= left || bottom <= top) return;
  const scale = base.width ? width / base.width : 1;
  svg.setAttribute("viewBox", `${left} ${top} ${right - left} ${bottom - top}`);
  svg.setAttribute("width", String((right - left) * scale));
  svg.removeAttribute("height");
};

const named = (svg: SVGSVGElement) => {
  const name = svg.querySelector(":scope > title")?.textContent?.trim();
  for (const title of svg.querySelectorAll("title")) title.remove();
  if (name) svg.dataset.name = name;
};

export const drawInto = (host: HTMLElement, source: string): SVGSVGElement | null => {
  const svg = purifier.sanitize(source, SANITIZE).querySelector("svg");
  if (!svg) {
    host.replaceChildren();
    return null;
  }
  scoped(svg);
  named(svg);
  host.replaceChildren(svg);
  framed(svg);
  return svg;
};

export const nameOf = (svg: SVGSVGElement): string | null => svg.dataset.name || null;

export const drawingImage = async (svg: SVGSVGElement): Promise<Blob> => {
  const view = svg.viewBox.baseVal;
  const { width, height } = view?.width && view.height ? view : svg.getBBox();
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  if (!copy.hasAttribute("font-family")) copy.setAttribute("font-family", getComputedStyle(svg).fontFamily);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: VECTOR_TYPE }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * EXPORT_SCALE);
    canvas.height = Math.ceil(height * EXPORT_SCALE);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(IMAGE_TYPE))), IMAGE_TYPE),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
};
