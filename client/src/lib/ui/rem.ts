export const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

export const PAGE_INSET = "--page-inset";

export const PANE_GAP = "--pane-gap";

export const cssLength = (name: string): number => {
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-left:var(${name})`;
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).paddingLeft) || 0;
  probe.remove();
  return value;
};
