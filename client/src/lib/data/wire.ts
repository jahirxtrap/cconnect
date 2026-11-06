export type Wire = Record<string, unknown>;

export const text = (raw: Wire, key: string): string | null =>
  typeof raw[key] === "string" ? (raw[key] as string) : null;

export const number = (raw: Wire, key: string): number | null =>
  typeof raw[key] === "number" ? (raw[key] as number) : null;

export const flag = (raw: Wire, key: string): boolean => raw[key] === true;

export const choice = (raw: Wire, key: string): boolean | null =>
  typeof raw[key] === "boolean" ? (raw[key] as boolean) : null;

export const list = (raw: Wire, key: string): Wire[] =>
  Array.isArray(raw[key])
    ? (raw[key] as unknown[]).filter((item): item is Wire => !!item && typeof item === "object" && !Array.isArray(item))
    : [];

export const record = (raw: Wire, key: string): Wire =>
  raw[key] && typeof raw[key] === "object" && !Array.isArray(raw[key]) ? (raw[key] as Wire) : {};

export const strings = (raw: Wire, key: string): string[] =>
  Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((item): item is string => typeof item === "string") : [];
