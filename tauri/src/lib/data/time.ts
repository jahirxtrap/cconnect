export const formatClock = (millis: number): string =>
  new Date(millis).toLocaleTimeString(undefined, { timeStyle: "short" });

export const formatLogTime = (millis: number): string =>
  new Date(millis).toLocaleTimeString([], { hour12: false });

export const formatDateShort = (millis: number): string =>
  new Date(millis).toLocaleString([], {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDay = (millis: number): string =>
  new Date(millis).toLocaleDateString(undefined, { dateStyle: "medium" });

const MILLIS_PER_MINUTE = 60_000;
const MILLIS_PER_DAY = 86_400_000;

export const dayIndex = (millis: number): number =>
  Math.trunc((millis - new Date(millis).getTimezoneOffset() * MILLIS_PER_MINUTE) / MILLIS_PER_DAY);

export const formatDayTime = (millis: number): string =>
  new Date(millis).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });

export const parseIsoMillis = (value: string): number | null => {
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? null : millis;
};
