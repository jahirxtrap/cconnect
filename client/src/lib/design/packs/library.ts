import { forgetSyntax } from "$lib/markdown/highlighter";
import { theme } from "../theme.svelte";
import { openArchive, writeArchive } from "./archive";
import { dropFaces } from "./faces";
import type { Pack } from "./model";
import { readPack, type PackSource } from "./reader";
import { packs } from "./registry.svelte";
import { PACK_EXTENSION, PACK_MIME, THEME_KINDS } from "./schema";
import { archiveBlob, dropArchive, sourceOf, staleCatalog, storeArchive, writeCatalog } from "./storage";

export type PackStanding = "new" | "same" | "newer" | "older";

export interface InspectedPack {
  pack: Pack;
  source: PackSource;
  blob: Blob;
}

const versionParts = (version: string): number[] =>
  version.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);

export const compareVersions = (a: string, b: string): number => {
  const [left, right] = [versionParts(a), versionParts(b)];
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
};

export const standingFor = (id: string, version: string): PackStanding => {
  const installed = packs.installedOf(id);
  if (!installed) return "new";
  const order = compareVersions(version, installed.info.version);
  return order > 0 ? "newer" : order < 0 ? "older" : "same";
};

export const standingOf = (pack: Pack): PackStanding => standingFor(pack.info.id, pack.info.version);

export const contentsOf = (pack: Pack): Record<string, number> => ({
  themes: pack.themes.length,
  terminals: pack.terminals.length,
  syntax: pack.syntax.length,
  accents: pack.accents.length,
  fonts: pack.fonts.length,
  backgrounds: pack.backgrounds.length,
});

export const inspectPack = async (blob: Blob): Promise<InspectedPack> => {
  const source = openArchive(new Uint8Array(await blob.arrayBuffer()));
  return { pack: readPack(source, false, packs.known), source, blob };
};

const adopt = (installed: Pack[]) => {
  writeCatalog(installed);
  packs.installed = installed;
};

export const installPack = async ({ pack, blob }: InspectedPack) => {
  await dropFaces(pack.info.id);
  await storeArchive(pack.info.id, blob);
  adopt([...packs.installed.filter((item) => item.info.id !== pack.info.id), pack]);
  forgetSyntax(pack.syntax.map((syntax) => syntax.id));
};

export const removePack = async (id: string) => {
  const pack = packs.installedOf(id);
  if (!pack) return;
  adopt(packs.installed.filter((item) => item.info.id !== id));
  forgetSyntax(pack.syntax.map((syntax) => syntax.id));
  await dropFaces(id);
  await dropArchive(id);
};

export const packFileName = (pack: Pack): string => `${pack.info.id}${PACK_EXTENSION}`;

export const exportPack = async (pack: Pack): Promise<Blob | null> => {
  if (!pack.builtin) return archiveBlob(pack.info.id);
  const source = await sourceOf(pack.info.id);
  if (!source) return null;
  const files = new Map(
    source.paths.flatMap((path) => {
      const bytes = source.bytes(path);
      return bytes ? [[path, bytes] as const] : [];
    }),
  );
  return new Blob([writeArchive(files) as BlobPart], { type: PACK_MIME });
};

export const packSource = (pack: Pack): Promise<PackSource | null> =>
  pack.builtin ? Promise.resolve(null) : sourceOf(pack.info.id);

export const canUsePack = (pack: Pack): boolean =>
  pack.themes.length > 0 &&
  THEME_KINDS.every((kind) => pack.themes.filter((item) => item.kind === kind).length <= 1);

export const usePack = (pack: Pack) => {
  for (const item of pack.themes) theme.setTheme(item.kind, item.id);
  if (!pack.themes.some((item) => item.kind === theme.modeKind)) theme.setMode(pack.themes[0].kind);
};

export const restorePacks = async () => {
  const stale = staleCatalog();
  if (!stale.length) return;
  const restored: Pack[] = [];
  for (const id of stale) {
    const source = await sourceOf(id).catch(() => null);
    if (!source) continue;
    try {
      restored.push(readPack(source, false, packs.known));
    } catch {
      await dropArchive(id);
    }
  }
  adopt(restored);
};
