import { jsonBytes, jsonSource } from "./archive";
import type { Pack } from "./model";
import { readPack, type PackSource } from "./reader";
import { BUILTIN_PACK_IDS } from "./schema";

const FILES = import.meta.glob<unknown>("../../../../../backend/core/packs/*/**/*.json", { eager: true, import: "default" });

const ASSETS = import.meta.glob<string>(["../../../../../backend/core/packs/*/**/*", "!../../../../../backend/core/packs/**/*.json"], {
  eager: true,
  query: "?url",
  import: "default",
});

const ROOT = /^(?:\.\.\/)+backend\/core\/packs\//;

export const [APP_PACK, EXTRAS_PACK] = BUILTIN_PACK_IDS;

export const BUILTIN_SYNTAX: Record<string, () => Promise<unknown>> = {
  "github-dark-default": () => import("@shikijs/themes/github-dark-default"),
  "github-light-default": () => import("@shikijs/themes/github-light-default"),
  "github-dark-dimmed": () => import("@shikijs/themes/github-dark-dimmed"),
  "github-dark-high-contrast": () => import("@shikijs/themes/github-dark-high-contrast"),
  "github-light-high-contrast": () => import("@shikijs/themes/github-light-high-contrast"),
  dracula: () => import("@shikijs/themes/dracula"),
  nord: () => import("@shikijs/themes/nord"),
  "catppuccin-mocha": () => import("@shikijs/themes/catppuccin-mocha"),
  "catppuccin-latte": () => import("@shikijs/themes/catppuccin-latte"),
  "solarized-dark": () => import("@shikijs/themes/solarized-dark"),
  "solarized-light": () => import("@shikijs/themes/solarized-light"),
  "tokyo-night": () => import("@shikijs/themes/tokyo-night"),
  "one-dark-pro": () => import("@shikijs/themes/one-dark-pro"),
  "gruvbox-dark-medium": () => import("@shikijs/themes/gruvbox-dark-medium"),
  "rose-pine": () => import("@shikijs/themes/rose-pine"),
  "dark-plus": () => import("@shikijs/themes/dark-plus"),
  "light-plus": () => import("@shikijs/themes/light-plus"),
};

const inPack = <T>(entries: Record<string, T>, pack: string): Map<string, T> =>
  new Map(
    Object.entries(entries).flatMap(([key, value]) => {
      const path = key.replace(ROOT, "");
      return path.startsWith(`${pack}/`) ? [[path.slice(pack.length + 1), value] as const] : [];
    }),
  );

export const builtinSource = async (pack: string): Promise<PackSource> => {
  const assets = await Promise.all(
    [...inPack(ASSETS, pack)].map(async ([path, url]) => [path, new Uint8Array(await (await fetch(url)).arrayBuffer())] as const),
  );
  const files = new Map([...[...inPack(FILES, pack)].map(([path, value]) => [path, jsonBytes(value)] as const), ...assets]);
  return jsonSource([...files.keys()], (path) => files.get(path));
};

const known = { themes: new Set<string>(), syntax: new Set(Object.keys(BUILTIN_SYNTAX)) };

export const BUILTIN_PACKS: readonly Pack[] = BUILTIN_PACK_IDS.map((id) => {
  const files = inPack(FILES, id);
  const paths = [...files.keys(), ...inPack(ASSETS, id).keys()];
  const pack = readPack({ paths, json: (path) => files.get(path), bytes: () => undefined }, true, known);
  return id === APP_PACK
    ? { ...pack, syntax: Object.keys(BUILTIN_SYNTAX).map((syntax) => ({ id: syntax, pack: id, name: syntax, file: null })) }
    : pack;
});