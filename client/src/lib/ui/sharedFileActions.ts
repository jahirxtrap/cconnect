import AtSign from "@lucide/svelte/icons/at-sign";
import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
import Copy from "@lucide/svelte/icons/copy";
import Download from "@lucide/svelte/icons/download";
import ExternalLink from "@lucide/svelte/icons/external-link";
import Eye from "@lucide/svelte/icons/eye";
import FolderArchive from "@lucide/svelte/icons/folder-archive";
import FolderInput from "@lucide/svelte/icons/folder-input";
import FolderOpen from "@lucide/svelte/icons/folder-open";
import HardDriveDownload from "@lucide/svelte/icons/hard-drive-download";
import Link2 from "@lucide/svelte/icons/link-2";
import Package from "@lucide/svelte/icons/package";
import PackageOpen from "@lucide/svelte/icons/package-open";
import Paperclip from "@lucide/svelte/icons/paperclip";
import Pencil from "@lucide/svelte/icons/pencil";
import Save from "@lucide/svelte/icons/save";
import Share2 from "@lucide/svelte/icons/share-2";
import Trash from "@lucide/svelte/icons/trash";
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

export const FILE_ACTION_ORDER = [
  "bring",
  "extract",
  "install",
  "view",
  "openInShared",
  "external",
  "rename",
  "move",
  "copy",
  "duplicate",
  "compress",
  "save",
  "saveAs",
  "share",
  "attach",
  "mention",
  "link",
  "copyPath",
  "delete",
] as const;

export type FileActionId = (typeof FILE_ACTION_ORDER)[number];

export const FILE_ACTION_LOOK: Record<FileActionId, { label: string; icon: IconSource }> = {
  bring: { label: "BRING_HERE", icon: HardDriveDownload },
  extract: { label: "EXTRACT", icon: PackageOpen },
  install: { label: "PACK_INSTALL", icon: Package },
  view: { label: "VIEW", icon: Eye },
  openInShared: { label: "OPEN_IN_SHARED", icon: FolderOpen },
  external: { label: "OPEN_EXTERNALLY", icon: ExternalLink },
  rename: { label: "RENAME", icon: Pencil },
  move: { label: "MOVE", icon: FolderInput },
  copy: { label: "COPY", icon: Copy },
  duplicate: { label: "DUPLICATE", icon: Copy },
  compress: { label: "COMPRESS", icon: FolderArchive },
  save: { label: "SAVE", icon: Download },
  saveAs: { label: "SAVE_AS", icon: Save },
  share: { label: "SHARE", icon: Share2 },
  attach: { label: "ATTACH_TO_CHAT", icon: Paperclip },
  mention: { label: "MENTION_IN_CHAT", icon: AtSign },
  link: { label: "LINK_TO_SHARED", icon: Link2 },
  copyPath: { label: "COPY_PATH", icon: ClipboardCopy },
  delete: { label: "DELETE", icon: Trash },
};

export interface FileActionEntry {
  id: FileActionId;
  run: () => unknown;
}

export const inFileOrder = <T extends { id: FileActionId }>(entries: readonly T[]): T[] =>
  [...entries].sort((one, other) => FILE_ACTION_ORDER.indexOf(one.id) - FILE_ACTION_ORDER.indexOf(other.id));

export type FileSource = { url: string } | { blob: Blob };

export interface FileAction {
  id: FileActionId;
  run: (source: FileSource, filename: string) => unknown;
}

const either =
  (fromUrl: (url: string, filename: string) => unknown, fromBlob: (filename: string, blob: Blob) => unknown) =>
  (source: FileSource, filename: string) =>
    "url" in source ? fromUrl(source.url, filename) : fromBlob(filename, source.blob);

export const OPEN_EXTERNALLY_ACTION: FileAction = {
  id: "external",
  run: either(openSharedExternally, openFileExternally),
};

export const FILE_ACTIONS: readonly FileAction[] = inFileOrder([
  { id: "save", run: either(downloadShared, saveFileToDownloads) },
  { id: "saveAs", run: either(saveSharedAs, saveFileAs) },
  OPEN_EXTERNALLY_ACTION,
  { id: "share", run: either(shareShared, shareFile) },
]);

export const fileEntries = (actions: readonly FileAction[], source: FileSource, filename: string): FileActionEntry[] =>
  actions.map((action) => ({ id: action.id, run: () => action.run(source, filename) }));
