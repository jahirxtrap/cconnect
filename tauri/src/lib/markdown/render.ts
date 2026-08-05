import MarkdownIt from "markdown-it";

type Token = ReturnType<InstanceType<typeof MarkdownIt>["parse"]>[number];

export type Segment =
  | { kind: "html"; html: string }
  | { kind: "code"; code: string; lang: string | null }
  | { kind: "image"; url: string; alt: string }
  | { kind: "details"; summary: string; children: Segment[] };

const DETAILS_RE = /<details\b[^>]*>([\s\S]*?)<\/details>/i;
const SUMMARY_RE = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i;
const TASK_RE = /^\[([ xX])\]\s+/;
const DEFAULT_SUMMARY = "Details";
const ITEM_LOOKAHEAD = 3;

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

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
    result.push({ kind: "image", url: String(url), alt: child.content });
  }
  flush();
  return result;
};

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
      result.push({ kind: "code", code: token.content, lang: token.info.trim().split(/\s+/)[0] || null });
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
  return result;
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
