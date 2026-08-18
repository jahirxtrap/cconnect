export interface FilesLocation {
  path: string;
  archive: string | null;
  archiveDir: string;
}

const ROUTE = "/files";

const onFilesRoute = () => window.location.pathname === ROUTE;

const buildUrl = (location: FilesLocation): string => {
  const params: string[] = [];
  if (location.archive !== null) {
    params.push(`a=${encodeURIComponent(location.archive)}`);
    if (location.archiveDir) params.push(`ad=${encodeURIComponent(location.archiveDir)}`);
  } else if (location.path) {
    params.push(`p=${encodeURIComponent(location.path)}`);
  }
  return params.length ? `${ROUTE}?${params.join("&")}` : ROUTE;
};

export const readFilesLocation = (): FilesLocation | null => {
  if (!onFilesRoute()) return null;
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

export const syncFilesLocation = (location: FilesLocation) => {
  if (!onFilesRoute()) return;
  const target = buildUrl(location);
  if (target !== window.location.pathname + window.location.search) {
    window.history.replaceState(null, "", target);
  }
};
