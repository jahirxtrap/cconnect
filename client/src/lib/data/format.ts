import { i18n, plural } from "$lib/i18n/index.svelte";
import { MILLIS_PER_MINUTE, MILLIS_PER_SECOND } from "./time";

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

export const SEPARATOR = " • ";

export const joined = (...parts: (string | number | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(SEPARATOR);

const THOUSAND = 1000;
const MILLION = 1_000_000;
const DAYS_IN_YEAR = 365;
const PERCENT = 100;

export const formatTokens = (value: number): string => {
  if (value < THOUSAND) return `${value}`;
  const thousands = Math.round(value / THOUSAND);
  if (thousands < THOUSAND) return `${thousands}K`;
  return `${Math.round(value / (MILLION / 10)) / 10}M`;
};

type DurationUnit = "millisecond" | "second" | "minute";

const unitFormats = new Map<string, Intl.NumberFormat>();

const formatUnit = (value: number, unit: DurationUnit, decimals = 0): string => {
  const key = `${i18n.resolved}:${unit}:${decimals}`;
  let format = unitFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(i18n.resolved, {
      style: "unit",
      unit,
      unitDisplay: "short",
      maximumFractionDigits: decimals,
    });
    unitFormats.set(key, format);
  }
  return format.format(value);
};

export const formatDuration = (millis: number): string => {
  if (millis < MILLIS_PER_SECOND) return formatUnit(Math.round(millis), "millisecond");
  if (millis < MILLIS_PER_MINUTE) return formatUnit(millis / MILLIS_PER_SECOND, "second", 1);
  const minutes = Math.floor(millis / MILLIS_PER_MINUTE);
  const seconds = Math.round((millis % MILLIS_PER_MINUTE) / MILLIS_PER_SECOND);
  const whole = formatUnit(minutes, "minute");
  return seconds > 0 ? `${whole} ${formatUnit(seconds, "second")}` : whole;
};

export const formatDays = (days: number): string => {
  const years = Math.floor(days / DAYS_IN_YEAR);
  const rest = days % DAYS_IN_YEAR;
  const parts: string[] = [];
  if (years) parts.push(plural("DURATION_YEARS", years));
  if (rest || !years) parts.push(plural("DURATION_DAYS", rest));
  return parts.join(" ");
};

export const formatList = (items: readonly string[]): string => new Intl.ListFormat().format(items);

export const linesOf = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const MASK_LENGTH = 12;

export const masked = (length = MASK_LENGTH): string => "•".repeat(Math.min(length, MASK_LENGTH));

export const formatDecimal = (value: number, decimals: number, minimum = decimals): string =>
  value.toLocaleString(undefined, { minimumFractionDigits: minimum, maximumFractionDigits: decimals });

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${formatDecimal(value, 1, 0)} ${SIZE_UNITS[unit]}`;
};

export const usageRatio = (used: number, limit: number): number =>
  limit > 0 ? Math.min(1, Math.max(0, used / limit)) : 0;

export const formatPercent = (ratio: number): string => `${Math.round(ratio * PERCENT)}%`;

export const formatCurrency = (amount: number, currency: string): string =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);

export const formatUsage = (used: number, limit: number, unit: (value: number) => string): string =>
  joined(`${unit(used)} / ${unit(limit)}`, formatPercent(usageRatio(used, limit)));

const REFERENCE_SUFFIX = ".ccref";

export const visibleName = (name: string): string =>
  name.endsWith(REFERENCE_SUFFIX) ? name.slice(0, -REFERENCE_SUFFIX.length) : name;

export const isArchive = (name: string): boolean => {
  const lower = name.toLowerCase();
  return ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
};
