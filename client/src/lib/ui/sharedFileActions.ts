import Download from "@lucide/svelte/icons/download";
import ExternalLink from "@lucide/svelte/icons/external-link";
import Save from "@lucide/svelte/icons/save";
import Share2 from "@lucide/svelte/icons/share-2";
import {
  downloadShared,
  openFileExternally,
  openSharedExternally,
  saveFileAs,
  saveFileToDownloads,
  saveSharedAs,
  shareFile,
  shareShared,
} from "$lib/services/sharedFiles";
import type { IconSource } from "./icons";

export type FileSource = { url: string } | { blob: Blob };

export interface FileAction {
  label: string;
  icon: IconSource;
  run: (source: FileSource, filename: string) => unknown;
}

const either =
  (fromUrl: (url: string, filename: string) => unknown, fromBlob: (filename: string, blob: Blob) => unknown) =>
  (source: FileSource, filename: string) =>
    "url" in source ? fromUrl(source.url, filename) : fromBlob(filename, source.blob);

export const OPEN_EXTERNALLY_ACTION: FileAction = {
  label: "OPEN_EXTERNALLY",
  icon: ExternalLink,
  run: either(openSharedExternally, openFileExternally),
};

export const FILE_ACTIONS: readonly FileAction[] = [
  { label: "SAVE", icon: Download, run: either(downloadShared, saveFileToDownloads) },
  { label: "SAVE_AS", icon: Save, run: either(saveSharedAs, saveFileAs) },
  OPEN_EXTERNALLY_ACTION,
  { label: "SHARE", icon: Share2, run: either(shareShared, shareFile) },
];
