import { localized, plural } from "$lib/i18n/index.svelte";
import {
  DAYS_PER_YEAR,
  MILLIS_PER_DAY,
  MILLIS_PER_HOUR,
  MILLIS_PER_MINUTE,
  MILLIS_PER_MONTH,
  MILLIS_PER_SECOND,
  MILLIS_PER_YEAR,
  SECONDS_PER_MINUTE,
} from "./time";

const BYTES_PER_UNIT = 1024;
const SIZE_UNITS = ["kilobyte", "megabyte", "gigabyte", "terabyte"] as const;

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
const PERCENT = 100;

export const formatTokens = (value: number): string => {
  if (value < THOUSAND) return `${value}`;
  const thousands = Math.round(value / THOUSAND);
  if (thousands < THOUSAND) return `${thousands}K`;
  return `${Math.round(value / (MILLION / 10)) / 10}M`;
};

type MeasureUnit =
  | "millisecond"
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "month"
  | "year"
  | "celsius"
  | "millimeter"
  | "kilobit-per-second"
  | "byte"
  | "kilobyte"
  | "megabyte"
  | "gigabyte"
  | "terabyte";

const SPANS: { unit: MeasureUnit; millis: number }[] = [
  { unit: "year", millis: MILLIS_PER_YEAR },
  { unit: "month", millis: MILLIS_PER_MONTH },
  { unit: "day", millis: MILLIS_PER_DAY },
  { unit: "hour", millis: MILLIS_PER_HOUR },
  { unit: "minute", millis: MILLIS_PER_MINUTE },
  { unit: "second", millis: MILLIS_PER_SECOND },
];

export const formatUnit = (value: number, unit: MeasureUnit, decimals = 0): string =>
  localized(
    `unit:${unit}:${decimals}`,
    (locale) =>
      new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short", maximumFractionDigits: decimals }),
  ).format(value);

const collator = (key: string, options: Intl.CollatorOptions) =>
  localized(`collator:${key}`, (locale) => new Intl.Collator(locale, options));

export const compareText = (a: string, b: string): number => collator("text", { numeric: true }).compare(a, b);

export const compareNames = (a: string, b: string): number =>
  collator("name", { sensitivity: "base", numeric: true }).compare(a, b);

export const formatDuration = (millis: number): string => {
  if (millis < MILLIS_PER_SECOND) return formatUnit(Math.round(millis), "millisecond");
  if (millis < MILLIS_PER_MINUTE) return formatUnit(millis / MILLIS_PER_SECOND, "second", 1);
  const top = SPANS.findIndex((span) => millis >= span.millis);
  const major = SPANS[top];
  const minor = SPANS[top + 1];
  const whole = formatUnit(Math.floor(millis / major.millis), major.unit);
  const rest = Math.floor((millis % major.millis) / minor.millis);
  return rest > 0 ? `${whole} ${formatUnit(rest, minor.unit)}` : whole;
};

export const formatSeconds = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  return whole < SECONDS_PER_MINUTE ? formatUnit(whole, "second") : formatDuration(whole * MILLIS_PER_SECOND);
};

export const formatDays = (days: number): string => {
  const years = Math.floor(days / DAYS_PER_YEAR);
  const rest = days % DAYS_PER_YEAR;
  const parts: string[] = [];
  if (years) parts.push(plural("DURATION_YEARS", years));
  if (rest || !years) parts.push(plural("DURATION_DAYS", rest));
  return parts.join(" ");
};

export const formatList = (items: readonly string[]): string =>
  localized("list", (locale) => new Intl.ListFormat(locale)).format(items);

export const linesOf = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export const pairsText = (pairs: Record<string, string>): string =>
  Object.entries(pairs)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");

export const pairsOf = (text: string): Record<string, string> =>
  Object.fromEntries(
    linesOf(text)
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1)]),
  );

const MASK_LENGTH = 12;

export const masked = (length = MASK_LENGTH): string => "•".repeat(Math.min(length, MASK_LENGTH));

export const formatDecimal = (value: number, decimals: number, minimum = decimals): string =>
  localized(
    `decimal:${decimals}:${minimum}`,
    (locale) => new Intl.NumberFormat(locale, { minimumFractionDigits: minimum, maximumFractionDigits: decimals }),
  ).format(value);

export const formatSize = (bytes: number): string => {
  if (bytes < BYTES_PER_UNIT) return formatUnit(bytes, "byte");
  let value = bytes / BYTES_PER_UNIT;
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < SIZE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit++;
  }
  return formatUnit(value, SIZE_UNITS[unit], 1);
};

export const usageRatio = (used: number, limit: number): number =>
  limit > 0 ? Math.min(1, Math.max(0, used / limit)) : 0;

export const formatPercent = (ratio: number): string => `${Math.round(ratio * PERCENT)}%`;

export const formatCurrency = (amount: number, currency: string): string =>
  localized(`currency:${currency}`, (locale) => new Intl.NumberFormat(locale, { style: "currency", currency })).format(
    amount,
  );

export const formatUsage = (used: number, limit: number, unit: (value: number) => string): string =>
  joined(`${unit(used)} / ${unit(limit)}`, formatPercent(usageRatio(used, limit)));

const REFERENCE_SUFFIX = ".ccref";

export const visibleName = (name: string): string =>
  name.endsWith(REFERENCE_SUFFIX) ? name.slice(0, -REFERENCE_SUFFIX.length) : name;

export const isArchive = (name: string): boolean => {
  const lower = name.toLowerCase();
  return ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
};
