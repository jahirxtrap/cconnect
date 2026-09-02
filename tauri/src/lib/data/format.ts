import { plural } from "$lib/i18n/index.svelte";

const SIZE_UNITS = ["KB", "MB", "GB", "TB"];

const ARCHIVE_SUFFIXES = [
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".tar.gz",
  ".tgz",
  ".tar.bz2",
  ".tbz2",
  ".tar.xz",
  ".txz",
];

const THOUSAND = 1000;
const MILLION = 1_000_000;
const DAYS_IN_YEAR = 365;

export const formatTokens = (value: number): string => {
  if (value < THOUSAND) return `${value}`;
  const thousands = Math.round(value / THOUSAND);
  if (thousands < THOUSAND) return `${thousands}K`;
  return `${Math.round(value / (MILLION / 10)) / 10}M`;
};

export const formatDuration = (millis: number): string => {
  if (millis < 1000) return `${Math.round(millis)} ms`;
  if (millis < 60_000) return `${Math.round(millis / 100) / 10} s`;
  const minutes = Math.floor(millis / 60_000);
  const seconds = Math.round((millis % 60_000) / 1000);
  return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
};

export const formatDays = (days: number): string => {
  const years = Math.floor(days / DAYS_IN_YEAR);
  const rest = days % DAYS_IN_YEAR;
  const parts: string[] = [];
  if (years) parts.push(plural("DURATION_YEARS", years));
  if (rest || !years) parts.push(plural("DURATION_DAYS", rest));
  return parts.join(" ");
};

export const formatDecimal = (value: number, decimals: number): string =>
  value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${formatDecimal(value, 1)} ${SIZE_UNITS[unit]}`;
};

export const isArchive = (name: string): boolean => {
  const lower = name.toLowerCase();
  return ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
};
