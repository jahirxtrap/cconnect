export const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

export const PAGE_INSET = "--page-inset";

export const cssLength = (name: string): number =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
