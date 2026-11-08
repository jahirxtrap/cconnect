import { store } from "$lib/platform/storage";
import base from "./en.json";

type Catalog = Record<string, string>;

export const BASE_LOCALE = "en";

const BASE: Catalog = base;

const LOADERS: Record<string, () => Promise<Catalog>> = Object.fromEntries(
  Object.entries(import.meta.glob<Catalog>("./*.json", { import: "default" })).map(([path, load]) => [
    path.slice(2, -5),
    load,
  ]),
);

export const LOCALES: readonly string[] = Object.keys(LOADERS).sort((a, b) => a.localeCompare(b));

export type Locale = "system" | string;

const languageOf = (code: string) => code.split("-")[0].toLowerCase();

const matchLocale = (wanted: string): string | null =>
  LOCALES.find((code) => code.toLowerCase() === wanted.toLowerCase()) ??
  LOCALES.find((code) => languageOf(code) === languageOf(wanted)) ??
  null;

const systemLocale = (): string =>
  navigator.languages.map(matchLocale).find((code) => code !== null) ?? BASE_LOCALE;

const storedLocale = (): Locale => {
  const stored = store.get<string>("locale", "system");
  return stored !== "system" && !LOCALES.includes(stored) ? "system" : stored;
};

export const localeName = (code: string): string => {
  const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
};

const fill = (template: string, args: Array<string | number>): string =>
  args.length ? template.replace(/\{(\d+)\}/g, (_, index) => String(args[Number(index) - 1] ?? "")) : template;

const pluralForm = (catalog: Catalog, rules: Intl.PluralRules, key: string, count: number): string | undefined =>
  catalog[`${key}_${rules.select(count).toUpperCase()}`] ?? catalog[`${key}_OTHER`];

const BASE_RULES = new Intl.PluralRules(BASE_LOCALE);

const resolve = (locale: Locale) => (locale === "system" ? systemLocale() : locale);

class I18n {
  locale = $state<Locale>(storedLocale());

  #catalogs = $state.raw<Record<string, Catalog>>({ [BASE_LOCALE]: BASE });

  readonly resolved = $derived(resolve(this.locale));
  readonly catalog = $derived(this.#catalogs[this.resolved] ?? BASE);
  readonly rules = $derived(new Intl.PluralRules(this.resolved));

  constructor() {
    document.documentElement.lang = this.resolved;
  }

  #wanted: Locale | null = null;

  async load(locale: Locale = this.locale): Promise<boolean> {
    const code = resolve(locale);
    if (this.#catalogs[code] || !LOADERS[code]) return true;
    try {
      const catalog = await LOADERS[code]();
      this.#catalogs = { ...this.#catalogs, [code]: catalog };
      return true;
    } catch {
      return false;
    }
  }

  async set(locale: Locale) {
    const chosen = locale !== "system" && !LOCALES.includes(locale) ? "system" : locale;
    this.#wanted = chosen;
    if (!(await this.load(chosen)) || this.#wanted !== chosen) return;
    this.locale = chosen;
    store.set("locale", this.locale);
    document.documentElement.lang = this.resolved;
  }

  t(key: string, ...args: Array<string | number>): string {
    return fill(this.catalog[key] ?? BASE[key] ?? key, args);
  }

  plural(key: string, count: number, ...args: Array<string | number>): string {
    const template = pluralForm(this.catalog, this.rules, key, count) ?? pluralForm(BASE, BASE_RULES, key, count);
    return fill(template ?? key, [count, ...args]);
  }
}

export const i18n = new I18n();

if (import.meta.hot) void i18n.load();

export const t = (key: string, ...args: Array<string | number>) => i18n.t(key, ...args);

const formats = new Map<string, unknown>();

export const localized = <T>(key: string, make: (locale: string) => T): T => {
  const locale = i18n.resolved;
  const id = `${locale}|${key}`;
  let format = formats.get(id) as T | undefined;
  if (format === undefined) {
    format = make(locale);
    formats.set(id, format);
  }
  return format;
};

export const plural = (key: string, count: number, ...args: Array<string | number>) =>
  i18n.plural(key, count, ...args);
