import { store } from "$lib/platform/storage";

type Catalog = Record<string, string>;

export const BASE_LOCALE = "en";

const CATALOGS: Record<string, Catalog> = Object.fromEntries(
  Object.entries(import.meta.glob<Catalog>("./*.json", { eager: true, import: "default" })).map(([path, catalog]) => [
    path.slice(2, -5),
    catalog,
  ]),
);

export const LOCALES: readonly string[] = Object.keys(CATALOGS).sort((a, b) => a.localeCompare(b));

export type Locale = "system" | string;

const BASE = CATALOGS[BASE_LOCALE];

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

class I18n {
  locale = $state<Locale>(storedLocale());

  readonly resolved = $derived(this.locale === "system" ? systemLocale() : this.locale);
  readonly catalog = $derived(CATALOGS[this.resolved] ?? BASE);
  readonly rules = $derived(new Intl.PluralRules(this.resolved));

  constructor() {
    document.documentElement.lang = this.resolved;
  }

  set(locale: Locale) {
    this.locale = locale !== "system" && !LOCALES.includes(locale) ? "system" : locale;
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

export const t = (key: string, ...args: Array<string | number>) => i18n.t(key, ...args);

export const plural = (key: string, count: number, ...args: Array<string | number>) =>
  i18n.plural(key, count, ...args);
