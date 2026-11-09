import { untrack } from "svelte";
import type { SpinnerHold } from "./CenteredProgress.svelte";

export const PULL_REACH = 80;

const RESISTANCE = 0.5;
const STIFFNESS = 1500;
const SETTLED = 0.999;
const OVERSHOOT = 2;
const DAMPING = 4;
const MS = 1000;
const ARC_START = 0.4;
const ARC_TURNS = 0.8;
const TURN_START = -0.25;
const TURN_SPAN = 0.4;
const TURN_SCALE = 0.5;
const FULL_TURN = 360;
const TOP = 90;
const HALF = 2;

const progressOf = (pulled: number) => (pulled * RESISTANCE) / PULL_REACH;

const tensionOf = (progress: number) => {
  const overshoot = Math.min(Math.max(progress - 1, 0), OVERSHOOT);
  return overshoot - (overshoot * overshoot) / DAMPING;
};

export class PullState {
  fraction = $state(0);
  progress = $state(0);
  dragging = $state(false);
  held = $state(false);
  #frame = 0;
  #animating = false;

  get animating() {
    return this.#animating;
  }

  get arc(): SpinnerHold {
    const sweep = Math.max(Math.min(1, this.progress) - ARC_START, 0) / (1 - ARC_START);
    const start = (TURN_START + TURN_SPAN * sweep + tensionOf(this.progress)) * TURN_SCALE * FULL_TURN;
    return { sweep, turn: start + (sweep * ARC_TURNS * FULL_TURN) / HALF + TOP };
  }

  drag(distance: number) {
    this.dragging = true;
    this.held = true;
    this.progress = progressOf(distance);
    this.fraction = Math.min(this.progress, 1) + tensionOf(this.progress);
  }

  release(distance: number): boolean {
    this.dragging = false;
    return progressOf(distance) > 1;
  }

  settle(target: number) {
    cancelAnimationFrame(this.#frame);
    if (target > 0) this.held = false;
    const from = untrack(() => this.fraction);
    if (from === target) {
      this.#land(target);
      return;
    }
    this.#animating = true;
    const omega = Math.sqrt(STIFFNESS);
    const started = performance.now();
    const step = (now: number) => {
      const elapsed = (now - started) / MS;
      const progress = 1 - (1 + omega * elapsed) * Math.exp(-omega * elapsed);
      if (progress >= SETTLED) {
        this.#land(target);
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

  #land(target: number) {
    this.fraction = target;
    this.#animating = false;
    if (target === 0) this.held = false;
  }
}
