import { bundledLanguages } from "shiki/langs";
import type { GrammarState, HighlighterCore, ThemeRegistrationAny } from "shiki/core";
import { packs } from "$lib/design/packs/registry.svelte";

interface Highlighter {
  instance: HighlighterCore;
  toHtml: (typeof import("shiki/core"))["hastToHtml"];
}

export const VISIBLE_LINES = 80;
const BATCH_LINES = 16;
const SLICE_MS = 8;
const LINE_BREAK = /<br\s*\/?>/;

const ALIASES: Record<string, string> = {
  bashrc: "bash",
  cmd: "bat",
  conf: "ini",
  cxx: "cpp",
  ejs: "html",
  env: "dotenv",
  gitattributes: "properties",
  gitconfig: "ini",
  gitignore: "properties",
  h: "c",
  hh: "cpp",
  hpp: "cpp",
  htm: "html",
  m: "objective-c",
  make: "makefile",
  pyi: "python",
  tex: "latex",
};

let pending: Promise<Highlighter> | null = null;
const loaded = new Set<string>();
const themes = new Map<string, Promise<void>>();

const forgetting = <T>(load: Promise<T>, forget: () => void): Promise<T> => {
  load.catch(forget);
  return load;
};

const highlighter = () => {
  pending ??= forgetting(
    (async () => {
      const [{ createHighlighterCore, hastToHtml }, { createJavaScriptRegexEngine }] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
      ]);
      const instance = await createHighlighterCore({ themes: [], langs: [], engine: createJavaScriptRegexEngine() });
      return { instance, toHtml: hastToHtml };
    })(),
    () => (pending = null),
  );
  return pending;
};

const registration = async (syntax: string): Promise<ThemeRegistrationAny> => {
  const source = (await packs.loadSyntax(syntax)) as { default?: ThemeRegistrationAny } & ThemeRegistrationAny;
  return { ...(source.default ?? source), name: syntax };
};

const themeLoaded = (instance: HighlighterCore, syntax: string) => {
  let load = themes.get(syntax);
  if (!load) {
    load = forgetting(
      registration(syntax).then((theme) => instance.loadTheme(theme)),
      () => themes.delete(syntax),
    );
    themes.set(syntax, load);
  }
  return load;
};

export const forgetSyntax = (ids: readonly string[]) => {
  for (const id of ids) themes.delete(id);
};

export const resolveLang = (lang: string | null | undefined): string | null => {
  if (!lang) return null;
  const normalized = lang.toLowerCase().trim();
  const resolved = ALIASES[normalized] ?? normalized;
  return resolved in bundledLanguages ? resolved : null;
};

const prepared = async (lang: string, theme: string): Promise<Highlighter> => {
  const ready = await highlighter();
  await themeLoaded(ready.instance, theme);
  if (!loaded.has(lang)) {
    const grammar = await bundledLanguages[lang as keyof typeof bundledLanguages]();
    await ready.instance.loadLanguage(grammar as Parameters<HighlighterCore["loadLanguage"]>[0]);
    loaded.add(lang);
  }
  return ready;
};

const nextSlice = () => new Promise<void>((resolve) => setTimeout(resolve));

export async function* highlightSlices(
  code: string,
  lang: string,
  theme: string,
  firstLines = VISIBLE_LINES,
): AsyncGenerator<string[]> {
  const { instance, toHtml } = await prepared(lang, theme);
  const lines = code.split(/\r?\n/);
  let state: GrammarState | undefined;
  let at = 0;
  let least = firstLines;
  while (at < lines.length) {
    const started = performance.now();
    const slice: string[] = [];
    while (at < lines.length && (slice.length < least || performance.now() - started < SLICE_MS)) {
      const batch = lines.slice(at, at + BATCH_LINES);
      const root = instance.codeToHast(batch.join("\n"), {
        lang,
        theme,
        structure: "inline",
        grammarState: state,
      });
      state = instance.getLastGrammarState(root);
      slice.push(...toHtml(root).split(LINE_BREAK));
      at += batch.length;
    }
    yield slice;
    least = 0;
    if (at < lines.length) await nextSlice();
  }
}

export const highlightLines = async (code: string, lang: string, theme: string): Promise<string[]> => {
  const lines: string[] = [];
  for await (const slice of highlightSlices(code, lang, theme)) lines.push(...slice);
  return lines;
};

export const highlight = async (code: string, lang: string, theme: string): Promise<string> =>
  (await highlightLines(code, lang, theme)).join("<br>");
