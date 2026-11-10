import { settings } from "$lib/data/settings.svelte";

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

export const zoomOf = (host: string): number => settings.browserZoom[host] ?? 1;

export const setZoomOf = (host: string, value: number) => {
  if (!host) return;
  const { [host]: _kept, ...others } = settings.browserZoom;
  settings.browserZoom = value === 1 ? others : { ...others, [host]: value };
};
