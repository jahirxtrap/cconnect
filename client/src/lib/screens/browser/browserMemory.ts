import type { BrowserState } from "$lib/services/browserSocket";

export interface BrowserPosition {
  page: BrowserState;
  home: boolean;
  frame: ImageBitmap | null;
}

const positions = new Map<string, BrowserPosition>();

export const takeBrowser = (environment: string): BrowserPosition | undefined => {
  const saved = positions.get(environment);
  positions.delete(environment);
  return saved;
};

export const rememberBrowser = (environment: string, position: BrowserPosition) => {
  const replaced = positions.get(environment)?.frame;
  if (replaced && replaced !== position.frame) replaced.close();
  positions.set(environment, position);
};
