export const formatClock = (millis: number): string =>
  new Date(millis).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export const formatDay = (millis: number): string =>
  new Date(millis).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const MILLIS_PER_MINUTE = 60_000;
const MILLIS_PER_DAY = 86_400_000;

export const dayIndex = (millis: number): number =>
  Math.trunc((millis - new Date(millis).getTimezoneOffset() * MILLIS_PER_MINUTE) / MILLIS_PER_DAY);
