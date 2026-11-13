import { localized } from "$lib/i18n/index.svelte";

const dates = (key: string, options: Intl.DateTimeFormatOptions) =>
  localized(`date:${key}`, (locale) => new Intl.DateTimeFormat(locale, options));

export const formatClock = (millis: number): string => dates("clock", { timeStyle: "short" }).format(millis);

export const formatLogTime = (millis: number): string =>
  dates("log", { hour: "numeric", minute: "numeric", second: "numeric", hour12: false }).format(millis);

export const formatDateShort = (millis: number): string =>
  dates("short", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(millis);

export const formatDay = (millis: number): string => dates("day", { dateStyle: "medium" }).format(millis);

export const formatDateTime = (millis: number): string =>
  dates("datetime", { dateStyle: "medium", timeStyle: "short" }).format(millis);

export const MILLIS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3_600;
export const SECONDS_PER_DAY = 86_400;
export const MILLIS_PER_MINUTE = SECONDS_PER_MINUTE * MILLIS_PER_SECOND;
export const MILLIS_PER_HOUR = SECONDS_PER_HOUR * MILLIS_PER_SECOND;
export const MILLIS_PER_DAY = SECONDS_PER_DAY * MILLIS_PER_SECOND;
export const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;
export const MILLIS_PER_YEAR = DAYS_PER_YEAR * MILLIS_PER_DAY;
export const MILLIS_PER_MONTH = MILLIS_PER_YEAR / MONTHS_PER_YEAR;

const twoDigits = (value: number) => String(value).padStart(2, "0");

export const formatMediaTime = (seconds: number): string => {
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / SECONDS_PER_HOUR);
  const minutes = Math.floor((whole % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const rest = twoDigits(whole % SECONDS_PER_MINUTE);
  return hours ? `${hours}:${twoDigits(minutes)}:${rest}` : `${minutes}:${rest}`;
};

export const dayIndex = (millis: number): number =>
  Math.trunc((millis - new Date(millis).getTimezoneOffset() * MILLIS_PER_MINUTE) / MILLIS_PER_DAY);

const RECENT_DAYS = 1;

const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

export const formatRecent = (millis: number): string => {
  const days = dayIndex(Date.now()) - dayIndex(millis);
  if (days < 0 || days > RECENT_DAYS) return formatDateShort(millis);
  const relative = localized("relative", (locale) => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }));
  const day = capitalized(relative.format(-days, "day"));
  return days === 0 ? `${day} ${formatClock(millis)}` : day;
};

export const formatDayTime = (millis: number): string =>
  dates("weekday", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(millis);

export const parseIsoMillis = (value: string): number | null => {
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? null : millis;
};
