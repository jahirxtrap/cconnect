import type { HighlighterCore } from "shiki/core";

const DARK_THEME = "github-dark-default";
const LIGHT_THEME = "github-light-default";

const LANGS: Record<string, () => Promise<unknown>> = {
  bash: () => import("@shikijs/langs/bash"),
  css: () => import("@shikijs/langs/css"),
  diff: () => import("@shikijs/langs/diff"),
  html: () => import("@shikijs/langs/html"),
  java: () => import("@shikijs/langs/java"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  markdown: () => import("@shikijs/langs/markdown"),
  python: () => import("@shikijs/langs/python"),
  rust: () => import("@shikijs/langs/rust"),
  sql: () => import("@shikijs/langs/sql"),
  svelte: () => import("@shikijs/langs/svelte"),
  toml: () => import("@shikijs/langs/toml"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  xml: () => import("@shikijs/langs/xml"),
  yaml: () => import("@shikijs/langs/yaml"),
};

const ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "tsx",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  kt: "kotlin",
  kts: "kotlin",
  py: "python",
  rs: "rust",
  yml: "yaml",
  md: "markdown",
  htm: "html",
};

let pending: Promise<HighlighterCore> | null = null;
const loaded = new Set<string>();

const highlighter = () => {
  pending ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      themes: [import("@shikijs/themes/github-dark-default"), import("@shikijs/themes/github-light-default")],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return pending;
};

export const resolveLang = (lang: string | null | undefined): string | null => {
  if (!lang) return null;
  const normalized = lang.toLowerCase().trim();
  const resolved = ALIASES[normalized] ?? normalized;
  return resolved in LANGS ? resolved : null;
};

export const highlight = async (code: string, lang: string, dark: boolean): Promise<string> => {
  const instance = await highlighter();
  if (!loaded.has(lang)) {
    await instance.loadLanguage((await LANGS[lang]()) as Parameters<HighlighterCore["loadLanguage"]>[0]);
    loaded.add(lang);
  }
  return instance.codeToHtml(code, {
    lang,
    theme: dark ? DARK_THEME : LIGHT_THEME,
    structure: "inline",
  });
};
