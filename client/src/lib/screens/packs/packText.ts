import { joined } from "$lib/data/format";
import { contentsOf, standingFor, type PackStanding } from "$lib/design/packs/library";
import type { Pack } from "$lib/design/packs/model";
import { PackError } from "$lib/design/packs/reader";
import { packs } from "$lib/design/packs/registry.svelte";
import { plural, t } from "$lib/i18n/index.svelte";
import { serverPacks, type ServerPack } from "$lib/services/serverPacks.svelte";

export interface ServerStanding {
  entry: ServerPack;
  standing: PackStanding;
}

const OFFERED: PackStanding[] = ["new", "newer"];

export const isOffer = (standing: PackStanding) => OFFERED.includes(standing);

export const serverStandings = (): ServerStanding[] =>
  serverPacks.entries.map((entry) => ({ entry, standing: standingFor(entry.id, entry.version) }));

export const offeredPacks = () => serverStandings().filter(({ standing }) => isOffer(standing));

export const standingNote = (standing: PackStanding, installed = ""): string | null =>
  standing === "older" ? t("PACK_OLDER", installed) : standing === "newer" ? t("PACK_NEWER", installed) : null;

const COUNT_LABELS: [content: string, label: string][] = [
  ["themes", "PACK_THEMES"],
  ["terminals", "PACK_TERMINALS"],
  ["fonts", "PACK_FONTS"],
  ["accents", "PACK_ACCENTS"],
  ["backgrounds", "PACK_BACKGROUNDS"],
];

export const contentsSummary = (contents: Record<string, number>): string =>
  joined(...COUNT_LABELS.map(([content, label]) => (contents[content] ?? 0) > 0 && plural(label, contents[content])));

export const packSummary = (pack: Pack): string => contentsSummary(contentsOf(pack));

export const packByline = (pack: Pack): string => joined(pack.info.author, pack.info.version);

export const serverByline = ({ entry, standing }: ServerStanding): string =>
  standing === "new"
    ? joined(entry.author, entry.version, contentsSummary(entry.contents))
    : standing === "same"
      ? joined(entry.author, entry.version, t("PACK_INSTALLED"))
      : joined(entry.version, standingNote(standing, packs.installedOf(entry.id)?.info.version));

export const packErrorText = (error: unknown): string => {
  const known = error instanceof PackError ? error : new PackError("archive");
  return t(`PACK_ERROR_${known.code.toUpperCase()}`, ...known.args);
};
