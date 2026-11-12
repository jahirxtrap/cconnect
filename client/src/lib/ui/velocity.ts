const WINDOW_MS = 100;

export const FLING_SPEED = 350;

export class Velocity {
  #trail: { x: number; at: number }[] = [];

  start(x: number, at: number) {
    this.#trail = [{ x, at }];
  }

  add(x: number, at: number) {
    this.#trail = [...this.#recent(at), { x, at }];
  }

  at(endedAt: number): number {
    const recent = this.#recent(endedAt);
    const first = recent[0];
    const last = recent.at(-1);
    return first && last && last.at > first.at ? ((last.x - first.x) / (last.at - first.at)) * 1000 : 0;
  }

  #recent(until: number) {
    return this.#trail.filter((sample) => sample.at >= until - WINDOW_MS);
  }
}
