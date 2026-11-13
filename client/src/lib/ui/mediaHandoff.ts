export interface Handoff {
  at: number;
  playing: boolean;
}

const pending = new Map<string, Handoff>();

export const leaveHandoff = (url: string, handoff: Handoff) => {
  pending.set(url, handoff);
};

export const takeHandoff = (url: string): Handoff | null => {
  const found = pending.get(url) ?? null;
  pending.delete(url);
  return found;
};
