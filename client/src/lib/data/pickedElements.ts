export type ElementSource = "device" | "server";

export interface PickedElement {
  source: ElementSource;
  url: string;
  title: string;
  selector: string;
  width: number;
  height: number;
  html: string;
}

const BLOCK = /<browser-element ([^>]*)>\n([\s\S]*?)\n<\/browser-element>/g;
const ATTRIBUTE = /(\w+)="([^"]*)"/g;
const SIZE = /^(\d+)x(\d+)$/;
const TAG = /^<([a-z][\w-]*)/i;
const MARKUP = /<[^>]*>/g;
const SPACE = /\s+/g;
const LABEL_LENGTH = 40;

const attribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const unattribute = (value: string) => value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");

const elementBlock = (element: PickedElement) => {
  const fields = [
    ["browser", element.source],
    ["url", element.url],
    ["title", element.title],
    ["selector", element.selector],
    ["size", `${Math.round(element.width)}x${Math.round(element.height)}`],
  ];
  const head = fields.map(([name, value]) => `${name}="${attribute(value)}"`).join(" ");
  return `<browser-element ${head}>\n${element.html}\n</browser-element>`;
};

const elementOf = (head: string, html: string): PickedElement => {
  const fields = Object.fromEntries([...head.matchAll(ATTRIBUTE)].map(([, name, value]) => [name, unattribute(value)]));
  const size = SIZE.exec(fields.size ?? "");
  return {
    source: fields.browser === "server" ? "server" : "device",
    url: fields.url ?? "",
    title: fields.title ?? "",
    selector: fields.selector ?? "",
    width: Number(size?.[1] ?? 0),
    height: Number(size?.[2] ?? 0),
    html,
  };
};

export const withElements = (text: string, elements: PickedElement[]) =>
  [text, ...elements.map(elementBlock)].filter(Boolean).join("\n\n");

export const splitElements = (text: string): { text: string; elements: PickedElement[] } => {
  const elements: PickedElement[] = [];
  const rest = text.replace(BLOCK, (_, head: string, html: string) => {
    elements.push(elementOf(head, html));
    return "";
  });
  return { text: elements.length ? rest.trim() : text, elements };
};

export const elementLabel = (element: PickedElement) => {
  const tag = TAG.exec(element.html)?.[1]?.toLowerCase() ?? "element";
  const words = element.html.replace(MARKUP, " ").replace(SPACE, " ").trim();
  return words ? `<${tag}> ${words.slice(0, LABEL_LENGTH)}` : `<${tag}>`;
};

export const readableText = (text: string) => {
  const split = splitElements(text);
  return [split.text, ...split.elements.map(elementLabel)].filter(Boolean).join("\n");
};
