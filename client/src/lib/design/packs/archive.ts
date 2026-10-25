import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { formatSize } from "$lib/data/format";
import { PackError, type PackSource } from "./reader";
import { MANIFEST, MAX_FILE_BYTES, MAX_PACK_BYTES } from "./schema";

const UNSAFE_SEGMENTS = new Set(["", ".", ".."]);

const normalized = (name: string): string => name.replaceAll("\\", "/").replace(/^\.\//, "");

const strippedRoot = (paths: string[]): string => {
  if (paths.includes(MANIFEST)) return "";
  const roots = new Set(paths.map((path) => path.split("/")[0]));
  const [root] = roots;
  return roots.size === 1 && paths.includes(`${root}/${MANIFEST}`) ? `${root}/` : "";
};

export const jsonSource = (paths: readonly string[], read: (path: string) => Uint8Array | undefined): PackSource => {
  const parsed = new Map<string, unknown>();
  return {
    paths,
    bytes: read,
    json(path) {
      if (parsed.has(path)) return parsed.get(path);
      const data = read(path);
      if (!data) throw new PackError("json", path);
      try {
        const value: unknown = JSON.parse(strFromU8(data));
        parsed.set(path, value);
        return value;
      } catch {
        throw new PackError("json", path);
      }
    },
  };
};

export const openArchive = (data: Uint8Array): PackSource => {
  if (data.byteLength > MAX_PACK_BYTES) throw new PackError("size", MANIFEST, formatSize(MAX_PACK_BYTES));
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data, {
      filter: (file) => {
        if (file.originalSize > MAX_FILE_BYTES) throw new PackError("size", file.name, formatSize(MAX_FILE_BYTES));
        return !file.name.endsWith("/");
      },
    });
  } catch (error) {
    throw error instanceof PackError ? error : new PackError("archive");
  }
  const files = Object.entries(entries).map(([name, bytes]) => [normalized(name), bytes] as const);
  const total = files.reduce((sum, [, bytes]) => sum + bytes.byteLength, 0);
  if (total > MAX_PACK_BYTES) throw new PackError("size", MANIFEST, formatSize(MAX_PACK_BYTES));
  const unsafe = files.find(([path]) => path.startsWith("/") || path.split("/").some((part) => UNSAFE_SEGMENTS.has(part)));
  if (unsafe) throw new PackError("format", unsafe[0]);
  const root = strippedRoot(files.map(([path]) => path));
  const contents = new Map(
    files.filter(([path]) => path.startsWith(root)).map(([path, bytes]) => [path.slice(root.length), bytes] as const),
  );
  return jsonSource([...contents.keys()], (path) => contents.get(path));
};

const isManifest = (path: string): boolean =>
  path === MANIFEST || (path.split("/").length === 2 && path.endsWith(`/${MANIFEST}`));

export const holdsManifest = (data: Uint8Array): boolean => {
  if (data.byteLength > MAX_PACK_BYTES) return false;
  try {
    return Object.keys(unzipSync(data, { filter: (file) => isManifest(normalized(file.name)) })).length > 0;
  } catch {
    return false;
  }
};

export const writeArchive = (files: ReadonlyMap<string, Uint8Array>): Uint8Array => zipSync(Object.fromEntries(files));

export const jsonBytes = (value: unknown): Uint8Array => strToU8(`${JSON.stringify(value, null, 2)}\n`);
