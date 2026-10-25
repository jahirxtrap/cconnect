import Ban from "@lucide/svelte/icons/ban";
import File from "@lucide/svelte/icons/file";
import FileArchive from "@lucide/svelte/icons/file-archive";
import FileCode from "@lucide/svelte/icons/file-code";
import FileImage from "@lucide/svelte/icons/file-image";
import FileMusic from "@lucide/svelte/icons/file-music";
import FileText from "@lucide/svelte/icons/file-text";
import FileType from "@lucide/svelte/icons/file-type";
import FileVideoCamera from "@lucide/svelte/icons/file-video-camera";
import Folder from "@lucide/svelte/icons/folder";
import FolderClosed from "@lucide/svelte/icons/folder-closed";
import FolderGit from "@lucide/svelte/icons/folder-git";
import FolderGit2 from "@lucide/svelte/icons/folder-git-2";
import FolderUp from "@lucide/svelte/icons/folder-up";
import Package from "@lucide/svelte/icons/package";
import { fileKindOf, type FileKind } from "$lib/data/previewKind";
import type { IconSource } from "./icons";

const KIND_ICONS: Record<FileKind, IconSource> = {
  image: FileImage,
  video: FileVideoCamera,
  audio: FileMusic,
  pdf: FileText,
  markdown: FileType,
  code: FileCode,
  archive: FileArchive,
  pack: Package,
  text: File,
};

const KIND_LABELS: Record<FileKind, string> = {
  image: "KIND_IMAGE",
  video: "KIND_VIDEO",
  audio: "KIND_AUDIO",
  pdf: "KIND_PDF",
  markdown: "KIND_MARKDOWN",
  code: "KIND_CODE",
  archive: "KIND_ARCHIVE",
  pack: "KIND_PACK",
  text: "KIND_TEXT",
};

export const kindIcon = (kind: FileKind): IconSource => KIND_ICONS[kind];

export const kindLabel = (kind: FileKind): string => KIND_LABELS[kind];

const GITIGNORE = ".gitignore";

export const fileIcon = (name: string): IconSource =>
  name.split("/").pop() === GITIGNORE ? Ban : KIND_ICONS[fileKindOf(name)];

export const folderIcon = (path: string, projectKeys: ReadonlySet<string>, uploadDir: string): IconSource => {
  const segments = path.split("/").filter(Boolean);
  const name = segments[segments.length - 1] ?? "";
  if (name === uploadDir) return FolderUp;
  return segments.length === 1 && projectKeys.has(name) ? FolderClosed : Folder;
};

const GIT_DIR = ".git";

export const projectIcon = (path: string, isDir: boolean, isRepo: boolean): IconSource => {
  if (!isDir) return fileIcon(path);
  if (isRepo) return FolderGit2;
  return path.split("/").pop() === GIT_DIR ? FolderGit : Folder;
};

export const entryIcon = (
  path: string,
  isDir: boolean,
  projectKeys: ReadonlySet<string>,
  uploadDir: string,
): IconSource => (isDir ? folderIcon(path, projectKeys, uploadDir) : fileIcon(path));
