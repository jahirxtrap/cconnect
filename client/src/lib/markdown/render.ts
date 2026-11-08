import MarkdownIt from "markdown-it";
import { CCONNECT_LANG, parseCconnectBlock, type CconnectBlock } from "./cconnectBlock";
import { githubHtml } from "./githubHtml";

type Token = ReturnType<InstanceType<typeof MarkdownIt>["parse"]>[number];

export interface MarkdownImage {
  url: string;
  alt: string;
}

export interface ListItem {
  marker: string;
  className: string;
  children: Segment[];
}

export type Segment =
  | { kind: "html"; html: string }
  | { kind: "code"; code: string; lang: string | null }
  | { kind: "images"; items: MarkdownImage[] }
  | { kind: "block"; data: CconnectBlock }
  | { kind: "details"; summary: string; children: Segment[] }
  | { kind: "list"; ordered: boolean; items: ListItem[] };

const DETAILS_RE = /<details\b[^>]*>([\s\S]*?)<\/details>/i;
const SUMMARY_RE = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i;
const TASK_RE = /^\[([ xX])\]\s+/;
const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)]\s*$/i;
const DEFAULT_SUMMARY = "Details";
const ITEM_LOOKAHEAD = 3;
const ALERT_LOOKAHEAD = 2;

const BULLETS = ["•", "◦", "▪"];
const LIST_OPEN = new Set(["bullet_list_open", "ordered_list_open"]);
const LIST_CLOSE = new Set(["bullet_list_close", "ordered_list_close"]);

const markerOf = (token: Token): string => String(token.meta?.marker ?? "");

const engine = (html: boolean, breaks: boolean) => {
  const instance = new MarkdownIt({ html, linkify: true, breaks });

  instance.core.ruler.push("task_markers", (state) => {
    const tokens = state.tokens;
    tokens.forEach((token, index) => {
      if (token.type !== "list_item_open") return;
      const inline = tokens.slice(index + 1, index + 1 + ITEM_LOOKAHEAD).find((item) => item.type === "inline");
      const match = inline?.content.match(TASK_RE);
      if (!inline || !match) return;
      inline.content = inline.content.replace(TASK_RE, "");
      const first = inline.children?.[0];
      if (first) first.content = first.content.replace(TASK_RE, "");
      token.attrJoin("class", match[1].toLowerCase() === "x" ? "task task-done" : "task");
    });
    return true;
  });

  instance.core.ruler.push("list_markers", (state) => {
    const lists: { ordered: boolean; next: number }[] = [];
    let bullets = 0;
    for (const token of state.tokens) {
      if (token.type === "ordered_list_open") lists.push({ ordered: true, next: Number(token.attrGet("start") ?? 1) });
      else if (token.type === "bullet_list_open") {
        lists.push({ ordered: false, next: 0 });
        bullets++;
      } else if (LIST_CLOSE.has(token.type)) {
        if (lists.pop()?.ordered === false) bullets--;
      } else if (token.type === "list_item_open") {
        const list = lists[lists.length - 1];
        const classes = String(token.attrGet("class") ?? "");
        const marker = classes.includes("task-done")
          ? "☑"
          : classes.includes("task")
            ? "☐"
            : list?.ordered
              ? `${list.next++}.`
              : BULLETS[Math.min(Math.max(bullets, 1) - 1, BULLETS.length - 1)];
        token.meta = { ...token.meta, marker };
      }
    }
    return true;
  });

  instance.core.ruler.push("github_alerts", (state) => {
    const tokens = state.tokens;
    tokens.forEach((token, index) => {
      if (token.type !== "blockquote_open") return;
      const inline = tokens.slice(index + 1, index + 1 + ALERT_LOOKAHEAD).find((item) => item.type === "inline");
      const match = inline?.content.split("\n")[0].match(ALERT_RE);
      if (!inline || !match) return;
      const kind = match[1].toLowerCase();
      token.attrJoin("class", `md-alert md-alert-${kind}`);
      token.attrSet("data-alert", kind);
      inline.content = inline.content.split("\n").slice(1).join("\n");
      inline.children = inline.children?.slice(inline.children.findIndex((child) => child.type === "softbreak") + 1) ?? [];
    });
    return true;
  });

  instance.renderer.rules.list_item_open = (tokens, index, options, _env, self) =>
    `${self.renderToken(tokens, index, options)}<span class="li-marker">${markerOf(tokens[index])}&nbsp;</span>`;

  return instance;
};

export type MarkdownFlavor = "chat" | "note" | "document";

const md = engine(false, true);

const ENGINES: Record<MarkdownFlavor, InstanceType<typeof MarkdownIt>> = {
  chat: md,
  note: engine(true, true),
  document: engine(true, false),
};

const cleaned = (flavor: MarkdownFlavor, html: string): string => (flavor === "chat" ? html : githubHtml(html));

export const renderInline = (markdown: string): string => md.renderInline(markdown);

const WIKI_LINK_RE = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;

export const wikiLinks = (markdown: string): string =>
  markdown.replace(WIKI_LINK_RE, (_match, target: string, label?: string) => `[${(label ?? target).trim()}](${target.trim()})`);

const spokenInline = (token: Token): string => {
  let href: string | null = null;
  let text = "";
  for (const child of token.children ?? []) {
    if (child.type === "link_open") href = String(child.attrGet("href") ?? "");
    else if (child.type === "link_close") href = null;
    else if ((child.type === "text" || child.type === "code_inline") && child.content !== href) text += child.content;
    else if (child.type === "softbreak" || child.type === "hardbreak") text += " ";
  }
  return text.replace(/\s+/g, " ").trim();
};

export const speakableParagraphs = (markdown: string): string[] => {
  const paragraphs: string[] = [];
  let row: string[] | null = null;
  for (const token of md.parse(markdown, {})) {
    if (token.type === "tr_open") row = [];
    else if (token.type === "tr_close" && row) {
      if (row.length) paragraphs.push(row.join(", "));
      row = null;
    } else if (token.type === "inline") {
      const text = spokenInline(token);
      if (text) (row ?? paragraphs).push(text);
    }
  }
  return paragraphs;
};

const PLAIN_TEXT = new Set(["text", "text_special", "code_inline"]);
const LINE_BREAKS = new Set(["softbreak", "hardbreak"]);
const CODE_BLOCKS = new Set(["fence", "code_block"]);

const plainInline = (token: Token): string =>
  (token.children ?? [])
    .map((child) => (PLAIN_TEXT.has(child.type) ? child.content : LINE_BREAKS.has(child.type) ? "\n" : ""))
    .join("");

const htmlText = (html: string): string =>
  new DOMParser().parseFromString(githubHtml(html), "text/html").body.textContent ?? "";

export const plainLines = (markdown: string): string[] => {
  const blocks: string[] = [];
  let row: string[] | null = null;
  for (const token of ENGINES.note.parse(markdown, {})) {
    if (token.type === "tr_open") row = [];
    else if (token.type === "tr_close" && row) {
      blocks.push(row.join(", "));
      row = null;
    } else if (token.type === "inline") (row ?? blocks).push(plainInline(token));
    else if (CODE_BLOCKS.has(token.type)) blocks.push(token.content);
    else if (token.type === "html_block") blocks.push(htmlText(token.content));
  }
  return blocks
    .flatMap((block) => block.split("\n"))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

const renderRun = (run: Token[]): string => md.renderer.renderInline(run, md.options, {}).trim();

const inlineSegments = (token: Token): Segment[] => {
  const children = token.children ?? [];
  if (!children.some((child) => child.type === "image")) return [];
  const result: Segment[] = [];
  let run: Token[] = [];

  const flush = () => {
    const html = run.length ? renderRun(run) : "";
    if (html) result.push({ kind: "html", html: `<p>${html}</p>` });
    run = [];
  };

  for (const child of children) {
    const url = child.type === "image" ? child.attrGet("src") : null;
    if (!url) {
      run.push(child);
      continue;
    }
    flush();
    result.push({ kind: "images", items: [{ url: String(url), alt: child.content }] });
  }
  flush();
  return result;
};

const holdsImage = (token: Token): boolean =>
  token.type === "inline" && (token.children ?? []).some((child) => child.type === "image");

const merged = (list: Segment[], joinHtml = true): Segment[] =>
  list.reduce<Segment[]>((acc, segment) => {
    const last = acc[acc.length - 1];
    if (segment.kind === "images" && last?.kind === "images") last.items.push(...segment.items);
    else if (joinHtml && segment.kind === "html" && last?.kind === "html") last.html += segment.html;
    else acc.push(segment.kind === "images" ? { ...segment, items: [...segment.items] } : { ...segment });
    return acc;
  }, []);

const closing = (tokens: Token[], index: number): number => {
  const { type, level } = tokens[index];
  const close = type.replace(/_open$/, "_close");
  for (let at = index + 1; at < tokens.length; at++) if (tokens[at].type === close && tokens[at].level === level) return at;
  return tokens.length;
};

const listSegment = (open: Token, inner: Token[], flavor: MarkdownFlavor): Segment => {
  const items: ListItem[] = [];
  for (let at = 0; at < inner.length; at++) {
    const token = inner[at];
    if (token.type !== "list_item_open" || token.level !== open.level + 1) continue;
    const end = closing(inner, at);
    items.push({
      marker: markerOf(token),
      className: String(token.attrGet("class") ?? ""),
      children: fromTokens(inner.slice(at + 1, end), flavor, token.level + 1),
    });
    at = end;
  }
  return { kind: "list", ordered: open.type === "ordered_list_open", items };
};

const fromTokens = (tokens: Token[], flavor: MarkdownFlavor, level = 0): Segment[] => {
  const result: Segment[] = [];
  const renderer = ENGINES[flavor];
  let buffer: Token[] = [];

  const flush = () => {
    if (!buffer.length) return;
    result.push({ kind: "html", html: cleaned(flavor, renderer.renderer.render(buffer, renderer.options, {})) });
    buffer = [];
  };

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === "fence" && token.level === level) {
      flush();
      const lang = token.info.trim().split(/\s+/)[0] || null;
      const block = lang === CCONNECT_LANG ? parseCconnectBlock(token.content) : null;
      result.push(block ? { kind: "block", data: block } : { kind: "code", code: token.content, lang });
      continue;
    }
    if (LIST_OPEN.has(token.type) && token.level === level) {
      const end = closing(tokens, index);
      const inner = tokens.slice(index + 1, end);
      if (inner.some((item) => item.type === "fence" || (flavor === "chat" && holdsImage(item)))) {
        flush();
        result.push(listSegment(token, inner, flavor));
        index = end;
        continue;
      }
    }
    const inline = token.type === "paragraph_open" && token.level === level ? tokens[index + 1] : undefined;
    const images = flavor === "chat" && inline?.type === "inline" ? inlineSegments(inline) : [];
    if (images.length) {
      flush();
      result.push(...images);
      index += 2;
      continue;
    }
    buffer.push(token);
  }
  flush();
  return merged(result);
};

export const segments = (markdown: string, flavor: MarkdownFlavor = "chat"): Segment[] => {
  const match = DETAILS_RE.exec(markdown);
  if (!match) return fromTokens(ENGINES[flavor].parse(markdown, {}), flavor);
  const body = match[1];
  const summary = cleaned(flavor, ENGINES[flavor].renderInline(SUMMARY_RE.exec(body)?.[1]?.trim() || DEFAULT_SUMMARY));
  const start = match.index;
  return [
    ...segments(markdown.slice(0, start), flavor),
    { kind: "details", summary, children: segments(body.replace(SUMMARY_RE, "").trim(), flavor) },
    ...segments(markdown.slice(start + match[0].length), flavor),
  ];
};

const BLANK_LINE_RE = /\n[ \t]*\r?\n/g;
const CONTINUATION_RE = /[ \t>]/;
const OPEN_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s|^\s*>/;
const FENCE = "```";
const DETAILS_OPEN = "<details";
const DETAILS_CLOSE = "</details>";

const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

const endsBlock = (chunk: string) => {
  const lines = chunk.split("\n").filter((line) => line.trim());
  return !OPEN_ITEM_RE.test(lines[lines.length - 1] ?? "");
};

export const createSegmenter = (flavor: MarkdownFlavor = "chat") => {
  let prefix = "";
  let head: Segment[] = [];
  let fences = 0;
  let details = 0;

  return (markdown: string): Segment[] => {
    if (!markdown.startsWith(prefix)) {
      prefix = "";
      head = [];
      fences = 0;
      details = 0;
    }
    const tail = markdown.slice(prefix.length);
    let cut = 0;
    let cutFences = fences;
    let cutDetails = details;
    let seenFences = fences;
    let seenDetails = details;
    let from = 0;
    BLANK_LINE_RE.lastIndex = 0;
    for (let match = BLANK_LINE_RE.exec(tail); match; match = BLANK_LINE_RE.exec(tail)) {
      const chunk = tail.slice(from, match.index);
      seenFences += occurrences(chunk, FENCE);
      seenDetails += occurrences(chunk, DETAILS_OPEN) - occurrences(chunk, DETAILS_CLOSE);
      from = match.index + match[0].length;
      const settled = seenFences % 2 === 0 && seenDetails === 0 && endsBlock(chunk);
      if (settled && from < tail.length && !CONTINUATION_RE.test(tail[from])) {
        cut = from;
        cutFences = seenFences;
        cutDetails = seenDetails;
      }
    }
    if (cut > 0) {
      head = [...head, ...segments(tail.slice(0, cut), flavor)];
      prefix = markdown.slice(0, prefix.length + cut);
      fences = cutFences;
      details = cutDetails;
    }
    const pending = segments(markdown.slice(prefix.length), flavor);
    return head.length ? merged([...head, ...pending], false) : pending;
  };
};
