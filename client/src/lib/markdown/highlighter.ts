import { bundledLanguages } from "shiki/langs";
import type { HighlighterCore, ThemeRegistrationAny } from "shiki/core";
import { packs } from "$lib/design/packs/registry.svelte";

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

let pending: Promise<HighlighterCore> | null = null;
const loaded = new Set<string>();
const themes = new Map<string, Promise<void>>();

const highlighter = () => {
  pending ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({ themes: [], langs: [], engine: createJavaScriptRegexEngine() });
  })();
  return pending;
};

const registration = async (syntax: string): Promise<ThemeRegistrationAny> => {
  const source = (await packs.loadSyntax(syntax)) as { default?: ThemeRegistrationAny } & ThemeRegistrationAny;
  return { ...(source.default ?? source), name: syntax };
};

const themeLoaded = (instance: HighlighterCore, syntax: string) => {
  let load = themes.get(syntax);
  if (!load) {
    load = registration(syntax).then((theme) => instance.loadTheme(theme));
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

export const highlight = async (code: string, lang: string, theme: string): Promise<string> => {
  const instance = await highlighter();
  await themeLoaded(instance, theme);
  if (!loaded.has(lang)) {
    const grammar = await bundledLanguages[lang as keyof typeof bundledLanguages]();
    await instance.loadLanguage(grammar as Parameters<HighlighterCore["loadLanguage"]>[0]);
    loaded.add(lang);
  }
  return instance.codeToHtml(code, { lang, theme, structure: "inline" });
};
