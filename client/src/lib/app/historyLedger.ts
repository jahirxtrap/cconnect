let own = [window.history.length - 1];
let settled = window.history.length;
let forward = 0;
let retreating = false;
let advancing = false;
const rewinds: number[] = [];

const ahead = () => (window.history.length === settled ? forward : 0);

const position = () => window.history.length - 1 - ahead();

export const pushEntry = (state: unknown, url: string) => {
  const from = position();
  window.history.pushState(state, "", url);
  const top = window.history.length - 1;
  const dropped = Math.max(0, from + 1 - top);
  own = [...own.filter((entry) => entry <= from && entry >= dropped).map((entry) => entry - dropped), top];
  settled = window.history.length;
  forward = 0;
  retreating = false;
  advancing = false;
};

export const replaceEntry = (state: unknown, url: string) => window.history.replaceState(state, "", url);

export const pendingRewind = () => rewinds.reduce((sum, steps) => sum + steps, 0);

export const rewind = (steps: number) => {
  forward = ahead() + steps;
  settled = window.history.length;
  rewinds.push(steps);
  window.history.go(-steps);
};

export const retreat = () => {
  if (retreating) return;
  const at = position();
  const shown = own.filter((entry) => entry <= at);
  const target = shown.at(-2) ?? (shown.at(-1) ?? at) - 1;
  if (target < 0) return;
  forward = ahead() + at - target;
  settled = window.history.length;
  retreating = true;
  window.history.go(target - at);
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
    settled = window.history.length;
  } else {
    forward = ahead() + 1;
    settled = window.history.length;
  }
  return false;
};
