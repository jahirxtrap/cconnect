export const formatClock = (millis: number): string =>
  new Date(millis).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (millis: number): string =>
  new Date(millis).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
