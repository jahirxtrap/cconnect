let mark = window.history.length;
let settled = window.history.length;
let forward = 0;
let retreating = false;
let advancing = false;
const rewinds: number[] = [];

const ahead = () => (window.history.length === settled ? forward : 0);

export const pushEntry = (state: unknown, url: string) => {
  window.history.pushState(state, "", url);
  mark = window.history.length;
  settled = mark;
  forward = 0;
  retreating = false;
  advancing = false;
};

export const replaceEntry = (state: unknown, url: string) => window.history.replaceState(state, "", url);

export const pendingRewind = () => rewinds.reduce((sum, steps) => sum + steps, 0);

export const rewind = (steps: number) => {
  forward = ahead() + steps;
  mark = Math.max(1, mark - steps);
  settled = window.history.length;
  rewinds.push(steps);
  window.history.go(-steps);
};

export const retreat = () => {
  if (retreating) return;
  const length = window.history.length;
  const stale = ahead();
  const foreign = Math.max(0, length - mark - stale);
  const steps = Math.min(foreign + 1, length - 1);
  if (steps <= 0) return;
  forward = stale + steps;
  mark = Math.max(1, mark - 1);
  settled = length;
  retreating = true;
  window.history.go(-steps);
};

export const advance = () => {
  if (ahead() <= 0) return;
  advancing = true;
  window.history.forward();
};

export const landed = () => {
  if (rewinds.shift() !== undefined) return true;
  if (retreating) {
    retreating = false;
  } else if (advancing) {
    advancing = false;
    forward = ahead() - 1;
    mark += 1;
    settled = window.history.length;
  } else {
    forward = ahead() + 1;
    mark = Math.max(1, mark - 1);
    settled = window.history.length;
  }
  return false;
};
