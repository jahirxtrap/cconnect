import { guessMimeType } from "$lib/data/previewKind";
import { isTauri } from "$lib/platform";

export const DROP_BORDER_CLASS = "border-2 border-accent/85";

export interface FileDropZone {
  accepts: () => boolean;
  drop: (files: File[]) => void;
}

export const hasFiles = (event: DragEvent): boolean =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

const zones = new Map<HTMLElement, FileDropZone>();

let highlighted: HTMLElement | null = null;

export const markDropTarget = (node: HTMLElement | null) => {
  if (highlighted === node) return;
  if (highlighted) delete highlighted.dataset.dropOver;
  if (node) node.dataset.dropOver = "";
  highlighted = node;
};

const nameOf = (path: string) => path.split(/[\\/]/).pop() || path;

const readPaths = async (paths: string[]): Promise<File[]> => {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const files: File[] = [];
  for (const path of paths) {
    const name = nameOf(path);
    try {
      const bytes = await readFile(path);
      files.push(new File([bytes], name, { type: guessMimeType(name) ?? "" }));
    } catch {
      continue;
    }
  }
  return files;
};

const zoneAt = (position: { x: number; y: number }) => {
  const ratio = window.devicePixelRatio || 1;
  const element = document.elementFromPoint(position.x / ratio, position.y / ratio);
  const node = element?.closest<HTMLElement>("[data-file-drop]") ?? null;
  const zone = node ? zones.get(node) : undefined;
  return zone?.accepts() ? { node, zone } : null;
};

let listening = false;

/** WebKitGTK never fills dataTransfer.files, so the desktop apps take the paths from Tauri. */
const listenNative = () => {
  if (listening || !isTauri) return;
  listening = true;
  let carryingFiles = false;
  void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
    getCurrentWebview().onDragDropEvent(async ({ payload }) => {
      if (payload.type === "enter") {
        carryingFiles = payload.paths.length > 0;
        return;
      }
      if (payload.type === "over") {
        if (carryingFiles) markDropTarget(zoneAt(payload.position)?.node ?? null);
        return;
      }
      if (payload.type !== "drop") {
        carryingFiles = false;
        markDropTarget(null);
        return;
      }
      const dropped = payload.paths;
      const target = carryingFiles || dropped.length ? zoneAt(payload.position) : null;
      carryingFiles = false;
      markDropTarget(null);
      if (!target) return;
      const files = await readPaths(dropped);
      if (files.length) target.zone.drop(files);
    }),
  );
};

export const fileDrop = (node: HTMLElement, zone: FileDropZone) => {
  node.dataset.fileDrop = "";
  zones.set(node, zone);
  listenNative();

  const enter = (event: DragEvent) => {
    if (!hasFiles(event) || !zone.accepts()) return;
    event.preventDefault();
    markDropTarget(node);
  };

  const leave = (event: DragEvent) => {
    if (!node.contains(event.relatedTarget as Node)) markDropTarget(null);
  };

  const release = (event: DragEvent) => {
    markDropTarget(null);
    if (!hasFiles(event) || !zone.accepts()) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) zone.drop(files);
  };

  node.addEventListener("dragover", enter);
  node.addEventListener("dragleave", leave);
  node.addEventListener("drop", release);

  return {
    destroy: () => {
      zones.delete(node);
      if (highlighted === node) markDropTarget(null);
      node.removeEventListener("dragover", enter);
      node.removeEventListener("dragleave", leave);
      node.removeEventListener("drop", release);
    },
  };
};
