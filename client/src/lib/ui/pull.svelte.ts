import { untrack } from "svelte";

export const PULL_REACH = 80;

const RESISTANCE = 0.5;
const STIFFNESS = 1500;
const SETTLED = 0.999;
const OVERSHOOT = 2;
const DAMPING = 4;
const MS = 1000;

const fractionOf = (pulled: number) => {
  const adjusted = pulled * RESISTANCE;
  if (adjusted <= PULL_REACH) return adjusted / PULL_REACH;
  const overshoot = Math.min(adjusted / PULL_REACH - 1, OVERSHOOT);
  return 1 + overshoot - (overshoot * overshoot) / DAMPING;
};

export class PullState {
  fraction = $state(0);
  dragging = $state(false);
  #frame = 0;
  #animating = false;

  get animating() {
    return this.#animating;
  }

  drag(distance: number) {
    this.dragging = true;
    this.fraction = fractionOf(distance);
  }

  release(distance: number): boolean {
    this.dragging = false;
    return distance * RESISTANCE > PULL_REACH;
  }

  settle(target: number) {
    cancelAnimationFrame(this.#frame);
    const from = untrack(() => this.fraction);
    if (from === target) {
      this.#animating = false;
      return;
    }
    this.#animating = true;
    const omega = Math.sqrt(STIFFNESS);
    const started = performance.now();
    const step = (now: number) => {
      const elapsed = (now - started) / MS;
      const progress = 1 - (1 + omega * elapsed) * Math.exp(-omega * elapsed);
      if (progress >= SETTLED) {
        this.fraction = target;
        this.#animating = false;
        return;
      }
      this.fraction = from + (target - from) * progress;
      this.#frame = requestAnimationFrame(step);
    };
    this.#frame = requestAnimationFrame(step);
  }

  dispose() {
    cancelAnimationFrame(this.#frame);
  }
}
