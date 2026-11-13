import { navigation } from "$lib/app/navigation.svelte";

export interface SharedLocation {
  path: string;
  archive: string | null;
  archiveDir: string;
}

const ROUTE = "/shared";

const onSharedRoute = () => window.location.pathname === ROUTE;

const buildUrl = (location: SharedLocation): string => {
  const params: string[] = [];
  if (location.archive !== null) {
    params.push(`a=${encodeURIComponent(location.archive)}`);
    if (location.archiveDir) params.push(`ad=${encodeURIComponent(location.archiveDir)}`);
  } else if (location.path) {
    params.push(`p=${encodeURIComponent(location.path)}`);
  }
  return params.length ? `${ROUTE}?${params.join("&")}` : ROUTE;
};

export const readSharedLocation = (): SharedLocation | null => {
  if (!onSharedRoute()) return null;
  const query = new URLSearchParams(window.location.search);
  const archive = query.get("a");
  if (archive !== null) {
    return {
      path: archive.split("/").slice(0, -1).join("/"),
      archive,
      archiveDir: query.get("ad") ?? "",
    };
  }
  return { path: query.get("p") ?? "", archive: null, archiveDir: "" };
};

export const syncSharedLocation = (location: SharedLocation) => {
  if (!onSharedRoute()) return;
  const target = buildUrl(location);
  if (target !== window.location.pathname + window.location.search) navigation.replace(null, target);
};
