export const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
