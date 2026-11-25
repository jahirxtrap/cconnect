import type { BrowserState } from "$lib/services/browserSocket";

const pages = new Map<string, BrowserState>();

export const takeBrowser = (environment: string): BrowserState | undefined => {
  const saved = pages.get(environment);
  pages.delete(environment);
  return saved;
};

export const rememberBrowser = (environment: string, page: BrowserState) => {
  pages.set(environment, page);
};
