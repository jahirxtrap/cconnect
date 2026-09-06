import MarkdownIt from "markdown-it";
import { CCONNECT_LANG, parseCconnectBlock, type CconnectBlock } from "./cconnectBlock";

type Token = ReturnType<InstanceType<typeof MarkdownIt>["parse"]>[number];

export interface MarkdownImage {
  url: string;
  alt: string;
}

export type Segment =
  | { kind: "html"; html: string }
  | { kind: "code"; code: string; lang: string | null }
  | { kind: "images"; items: MarkdownImage[] }
  | { kind: "block"; data: CconnectBlock }
  | { kind: "details"; summary: string; children: Segment[] };

const DETAILS_RE = /<details\b[^>]*>([\s\S]*?)<\/details>/i;
const SUMMARY_RE = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i;
const TASK_RE = /^\[([ xX])\]\s+/;
const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)]\s*$/i;
const DEFAULT_SUMMARY = "Details";
const ITEM_LOOKAHEAD = 3;
const ALERT_LOOKAHEAD = 2;

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

md.core.ruler.push("task_markers", (state) => {
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

md.core.ruler.push("github_alerts", (state) => {
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

const BULLETS = ["•", "◦", "▪"];
let bulletDepth = 0;
const counters: number[] = [];

md.renderer.rules.ordered_list_open = (tokens, index, options, _env, self) => {
  counters.push(Number(tokens[index].attrGet("start") ?? 1));
  return self.renderToken(tokens, index, options);
};

md.renderer.rules.ordered_list_close = (tokens, index, options, _env, self) => {
  counters.pop();
  return self.renderToken(tokens, index, options);
};

md.renderer.rules.bullet_list_open = (tokens, index, options, _env, self) => {
  bulletDepth++;
  return self.renderToken(tokens, index, options);
};

md.renderer.rules.bullet_list_close = (tokens, index, options, _env, self) => {
  bulletDepth--;
  return self.renderToken(tokens, index, options);
};

md.renderer.rules.list_item_open = (tokens, index, options, _env, self) => {
  const token = tokens[index];
  const classes = String(token.attrGet("class") ?? "");
  const marker = classes.includes("task-done")
    ? "☑"
    : classes.includes("task")
      ? "☐"
      : token.markup === "." || token.markup === ")"
        ? `${counters.length ? counters[counters.length - 1]++ : 1}.`
        : BULLETS[Math.min(Math.max(bulletDepth, 1) - 1, BULLETS.length - 1)];
  return `${self.renderToken(tokens, index, options)}<span class="li-marker">${marker}&nbsp;</span>`;
};

export const renderInline = (markdown: string): string => md.renderInline(markdown);

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

const merged = (list: Segment[]): Segment[] =>
  list.reduce<Segment[]>((acc, segment) => {
    const last = acc[acc.length - 1];
    if (segment.kind === "images" && last?.kind === "images") last.items.push(...segment.items);
    else if (segment.kind === "html" && last?.kind === "html") last.html += segment.html;
    else acc.push(segment.kind === "images" ? { ...segment, items: [...segment.items] } : { ...segment });
    return acc;
  }, []);

const fromTokens = (tokens: Token[]): Segment[] => {
  const result: Segment[] = [];
  let buffer: Token[] = [];

  const flush = () => {
    if (!buffer.length) return;
    result.push({ kind: "html", html: md.renderer.render(buffer, md.options, {}) });
    buffer = [];
  };

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === "fence" && token.level === 0) {
      flush();
      const lang = token.info.trim().split(/\s+/)[0] || null;
      const block = lang === CCONNECT_LANG ? parseCconnectBlock(token.content) : null;
      result.push(block ? { kind: "block", data: block } : { kind: "code", code: token.content, lang });
      continue;
    }
    const inline = token.type === "paragraph_open" && token.level === 0 ? tokens[index + 1] : undefined;
    const images = inline?.type === "inline" ? inlineSegments(inline) : [];
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

export const segments = (markdown: string): Segment[] => {
  const match = DETAILS_RE.exec(markdown);
  if (!match) return fromTokens(md.parse(markdown, {}));
  const body = match[1];
  const summary = SUMMARY_RE.exec(body)?.[1]?.trim() || DEFAULT_SUMMARY;
  const start = match.index;
  return [
    ...segments(markdown.slice(0, start)),
    { kind: "details", summary, children: segments(body.replace(SUMMARY_RE, "").trim()) },
    ...segments(markdown.slice(start + match[0].length)),
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

export const createSegmenter = () => {
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
      head = [...head, ...segments(tail.slice(0, cut))];
      prefix = markdown.slice(0, prefix.length + cut);
      fences = cutFences;
      details = cutDetails;
    }
    const pending = segments(markdown.slice(prefix.length));
    return head.length ? merged([...head, ...pending]) : pending;
  };
};
