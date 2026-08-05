import { store } from "$lib/platform/storage";
import en from "./en.json";
import es from "./es.json";

export type Locale = "system" | "en" | "es";

const CATALOGS: Record<string, Record<string, string>> = { en, es };

const systemLocale = (): string => (navigator.language.startsWith("es") ? "es" : "en");

class I18n {
  locale = $state<Locale>(store.get("locale", "system"));

  readonly resolved = $derived(this.locale === "system" ? systemLocale() : this.locale);
  readonly catalog = $derived(CATALOGS[this.resolved] ?? en);

  set(locale: Locale) {
    this.locale = locale;
    store.set("locale", locale);
    document.documentElement.lang = this.resolved;
  }

  t(key: string, ...args: Array<string | number>): string {
    const template = this.catalog[key] ?? en[key as keyof typeof en] ?? key;
    return args.length
      ? template.replace(/\{(\d+)\}/g, (_, index) => String(args[Number(index) - 1] ?? ""))
      : template;
  }

  plural(key: string, count: number, ...args: Array<string | number>): string {
    return this.t(`${key}_${count === 1 ? "ONE" : "OTHER"}`, count, ...args);
  }
}

export const i18n = new I18n();

export const t = (key: string, ...args: Array<string | number>) => i18n.t(key, ...args);

export const plural = (key: string, count: number, ...args: Array<string | number>) =>
  i18n.plural(key, count, ...args);
