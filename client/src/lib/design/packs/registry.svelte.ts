import { strFromU8 } from "fflate";
import { rgbOf, withAlpha } from "../accents";
import { BUILTIN_BACKGROUNDS } from "../backgrounds";
import { BUILTIN_FONTS, DEFAULT_FONTS, SYSTEM_FAMILIES, SYSTEM_FONT } from "../fonts";
import { DEFAULT_TERMINAL, DEFAULT_THEMES } from "../themes";
import { BUILTIN_PACKS, BUILTIN_SYNTAX, EXTRAS_PACK } from "./builtin";
import type { Pack, PackAccent, PackBackground, PackFont, PackTerminal, PackTheme, ThemeFile } from "./model";
import type { KnownIds } from "./reader";
import { DERIVED_COLORS, FONT_KINDS, type FontKind, type ThemeKind } from "./schema";
import { packFile, readCatalog } from "./storage";

const RGB_SOURCE = "on-surface-variant";

const EXTRAS_FONTS: PackFont[] = FONT_KINDS.flatMap((kind) =>
  BUILTIN_FONTS[kind].map((font) => ({ ...font, kind, pack: EXTRAS_PACK, face: null, files: [] })),
);

const EXTRAS_ART: PackBackground[] = BUILTIN_BACKGROUNDS.map((background) => ({
  ...background,
  pack: EXTRAS_PACK,
  name: null,
  file: null,
}));

const BUILTIN = BUILTIN_PACKS.map((pack) =>
  pack.info.id === EXTRAS_PACK
    ? { ...pack, fonts: EXTRAS_FONTS, backgrounds: [...EXTRAS_ART, ...pack.backgrounds] }
    : pack,
);

const byName = <T extends { name: string | null }>(items: T[]): T[] =>
  items.toSorted((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

const resolveThemes = (packs: readonly Pack[]): PackTheme[] => {
  const files = new Map(packs.flatMap((pack) => byName(pack.themes).map((file) => [file.id, file] as const)));
  const resolved = new Map<string, PackTheme>();
  const resolve = (file: ThemeFile): PackTheme => {
    const cached = resolved.get(file.id);
    if (cached) return cached;
    const parent = files.get(file.extends ?? DEFAULT_THEMES[file.kind]);
    const base = parent && parent.id !== file.id ? resolve(parent) : null;
    const colors = { ...base?.colors, ...file.colors };
    for (const [key, { from, alpha }] of Object.entries(DERIVED_COLORS)) {
      if (!(key in file.colors) && from in file.colors) colors[key] = withAlpha(file.colors[from], alpha);
    }
    colors[`${RGB_SOURCE}-rgb`] = rgbOf(colors[RGB_SOURCE]);
    const theme: PackTheme = {
      id: file.id,
      pack: file.pack,
      name: file.name,
      kind: file.kind,
      accent: file.accent ?? base?.accent ?? "",
      syntax: file.syntax ?? base?.syntax ?? "",
      colors,
    };
    resolved.set(file.id, theme);
    return theme;
  };
  return [...files.values()].map(resolve);
};

const resolveTerminals = (packs: readonly Pack[]): PackTerminal[] => {
  const terminals = packs.flatMap((pack) => byName(pack.terminals));
  const fallback = terminals.find((terminal) => terminal.id === DEFAULT_TERMINAL)?.colors ?? {};
  return terminals.map((terminal) => ({ ...terminal, colors: { ...fallback, ...terminal.colors } }));
};

class Packs {
  installed = $state<Pack[]>(readCatalog());

  readonly all = $derived<readonly Pack[]>([
    ...BUILTIN,
    ...this.installed.toSorted((a, b) => a.info.name.localeCompare(b.info.name)),
  ]);
  readonly themes = $derived(resolveThemes(this.all));
  readonly terminals = $derived(resolveTerminals(this.all));
  readonly accents = $derived<PackAccent[]>(this.all.flatMap((pack) => pack.accents));
  readonly fonts = $derived<PackFont[]>(this.all.flatMap((pack) => pack.fonts));
  readonly backgrounds = $derived<PackBackground[]>(this.all.flatMap((pack) => pack.backgrounds));

  readonly known: KnownIds = {
    themes: new Set(BUILTIN.flatMap((pack) => pack.themes.map((theme) => theme.id))),
    syntax: new Set(BUILTIN.flatMap((pack) => pack.syntax.map((syntax) => syntax.id))),
  };

  packOf(id: string): Pack | undefined {
    return this.all.find((pack) => pack.info.id === id);
  }

  installedOf(id: string): Pack | undefined {
    return this.installed.find((pack) => pack.info.id === id);
  }

  themesIn(pack: Pack): PackTheme[] {
    const pool = this.all.includes(pack) ? this.themes : resolveThemes([...BUILTIN, pack]);
    return pool.filter((theme) => theme.pack === pack.info.id);
  }

  terminalsIn(pack: Pack): PackTerminal[] {
    const pool = this.all.includes(pack) ? this.terminals : resolveTerminals([...BUILTIN, pack]);
    return pool.filter((terminal) => terminal.pack === pack.info.id);
  }

  themesOf(kind: ThemeKind): PackTheme[] {
    return this.themes.filter((theme) => theme.kind === kind);
  }

  themeOf(kind: ThemeKind, id: string): PackTheme {
    const themes = this.themesOf(kind);
    return themes.find((theme) => theme.id === id) ?? themes.find((theme) => theme.id === DEFAULT_THEMES[kind]) ?? themes[0];
  }

  terminalOf(id: string): PackTerminal {
    return (
      this.terminals.find((terminal) => terminal.id === id) ??
      this.terminals.find((terminal) => terminal.id === DEFAULT_TERMINAL) ??
      this.terminals[0]
    );
  }

  accentOf(id: string): PackAccent | undefined {
    return this.accents.find((accent) => accent.id === id);
  }

  backgroundOf(id: string): PackBackground | undefined {
    return this.backgrounds.find((background) => background.id === id);
  }

  fontsOf(kind: FontKind): PackFont[] {
    return this.fonts.filter((font) => font.kind === kind);
  }

  systemFont(kind: FontKind): PackFont {
    return { id: SYSTEM_FONT, pack: "", kind, name: null, family: SYSTEM_FAMILIES[kind], face: null, files: [] };
  }

  fontOf(kind: FontKind, id: string): PackFont {
    const fonts = this.fontsOf(kind);
    const find = (wanted: string) => (wanted === SYSTEM_FONT ? this.systemFont(kind) : fonts.find((font) => font.id === wanted));
    return find(id) ?? find(DEFAULT_FONTS[kind]) ?? fonts[0] ?? this.systemFont(kind);
  }

  async loadSyntax(id: string): Promise<unknown> {
    const builtin = BUILTIN_SYNTAX[id];
    if (builtin) return builtin();
    const syntax = this.all.flatMap((pack) => pack.syntax).find((item) => item.id === id);
    const data = syntax?.file ? await packFile(syntax.pack, syntax.file) : null;
    return data ? JSON.parse(strFromU8(data)) : BUILTIN_SYNTAX[this.themeOf("dark", DEFAULT_THEMES.dark).syntax]();
  }
}

export const packs = new Packs();
