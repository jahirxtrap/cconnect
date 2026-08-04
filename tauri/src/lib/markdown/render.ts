import MarkdownIt from "markdown-it";

export type Segment =
  | { kind: "html"; html: string }
  | { kind: "code"; code: string; lang: string | null };

// html: false keeps raw tags in the source escaped, so only markdown-generated
// markup reaches the DOM.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

export const renderInline = (markdown: string): string => md.renderInline(markdown);

export const segments = (markdown: string): Segment[] => {
  const tokens = md.parse(markdown, {});
  const result: Segment[] = [];
  let buffer: typeof tokens = [];

  const flush = () => {
    if (!buffer.length) return;
    result.push({ kind: "html", html: md.renderer.render(buffer, md.options, {}) });
    buffer = [];
  };

  for (const token of tokens) {
    if (token.type === "fence" && token.level === 0) {
      flush();
      result.push({ kind: "code", code: token.content, lang: token.info.trim().split(/\s+/)[0] || null });
      continue;
    }
    buffer.push(token);
  }
  flush();
  return result;
};
