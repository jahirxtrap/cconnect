import { joined } from "$lib/data/format";
import { contentsOf, standingFor } from "$lib/design/packs/library";
import type { Pack } from "$lib/design/packs/model";
import { PackError } from "$lib/design/packs/reader";
import { plural, t } from "$lib/i18n/index.svelte";
import { serverPacks } from "$lib/services/serverPacks.svelte";

export const offeredPacks = () =>
  serverPacks.entries
    .map((entry) => ({ entry, standing: standingFor(entry.id, entry.version) }))
    .filter(({ standing }) => standing === "new" || standing === "newer");

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

export const packErrorText = (error: unknown): string => {
  const known = error instanceof PackError ? error : new PackError("archive");
  return t(`PACK_ERROR_${known.code.toUpperCase()}`, ...known.args);
};
