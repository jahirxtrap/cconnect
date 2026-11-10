const TAU = Math.PI * 2;
const STAGES: readonly (readonly [order: number, amplitude: number])[] = [
  [3, 0.2],
  [4, 0.16],
  [5, 0.14],
  [6, 0.12],
];
const STEP_MS = 700;
const CYCLE_MS = STEP_MS * STAGES.length;
const QUARTER = TAU / 4;
const DAMPING = 0.75;
const STIFFNESS = 170;
const REACH = 0.98;
const SAMPLES = 60;
const INSET = 0.685;
const DIGITS = 3;
const CELL_ROOM = 1.2;

export const FILL_BOX = 2;
export const INSET_BOX = (2 * REACH) / INSET;

const natural = Math.sqrt(STIFFNESS);
const damped = natural * Math.sqrt(1 - DAMPING * DAMPING);
const decay = DAMPING * natural;

const settle = (ms: number) => {
  const time = ms / 1000;
  return 1 - Math.exp(-decay * time) * (Math.cos(damped * time) + (decay / damped) * Math.sin(damped * time));
};

const SETTLED = settle(STEP_MS);

const unit = Array.from({ length: SAMPLES }, (_, index) => (index / SAMPLES) * TAU);
const cosines = unit.map(Math.cos);
const sines = unit.map(Math.sin);
const waves = new Map(STAGES.map(([order]) => [order, unit.map((theta) => Math.cos(order * theta))]));

const xs = new Float64Array(SAMPLES);
const ys = new Float64Array(SAMPLES);

const shapeAt = (elapsed: number): number => {
  const step = Math.floor(elapsed / STEP_MS);
  const progress = settle(elapsed - step * STEP_MS) / SETTLED;
  const [fromOrder, fromAmplitude] = STAGES[step % STAGES.length];
  const [toOrder, toAmplitude] = STAGES[(step + 1) % STAGES.length];
  const from = waves.get(fromOrder)!;
  const to = waves.get(toOrder)!;
  const leaving = fromAmplitude * (1 - progress);
  const arriving = toAmplitude * progress;
  const turn = ((elapsed % CYCLE_MS) / CYCLE_MS) * TAU + ((step % STAGES.length) + progress) * QUARTER;
  const cosTurn = Math.cos(turn);
  const sinTurn = Math.sin(turn);
  let reach = 0;
  for (let index = 0; index < SAMPLES; index++) {
    const radius = 1 + leaving * from[index] + arriving * to[index];
    if (radius > reach) reach = radius;
    xs[index] = radius * (cosines[index] * cosTurn - sines[index] * sinTurn);
    ys[index] = radius * (sines[index] * cosTurn + cosines[index] * sinTurn);
  }
  return REACH / reach;
};

const areaRadiusAt = (elapsed: number): number => {
  const scale = shapeAt(elapsed);
  let doubled = 0;
  for (let index = 0; index < SAMPLES; index++) {
    const next = (index + 1) % SAMPLES;
    doubled += xs[index] * ys[next] - xs[next] * ys[index];
  }
  return scale * Math.sqrt(Math.abs(doubled) / 2 / Math.PI);
};

const pathAt = (elapsed: number): string => {
  const scale = shapeAt(elapsed);
  const point = (values: Float64Array, index: number) => values[(index + SAMPLES) % SAMPLES];
  const at = (values: Float64Array, index: number) => (point(values, index) * scale).toFixed(DIGITS);
  const control = (values: Float64Array, index: number, ahead: number, behind: number) =>
    ((point(values, index) + (point(values, ahead) - point(values, behind)) / 6) * scale).toFixed(DIGITS);
  let path = `M${at(xs, 0)} ${at(ys, 0)}`;
  for (let index = 0; index < SAMPLES; index++) {
    const next = index + 1;
    path +=
      `C${control(xs, index, next, index - 1)} ${control(ys, index, next, index - 1)} ` +
      `${control(xs, next, index, next + 1)} ${control(ys, next, index, next + 1)} ` +
      `${at(xs, next)} ${at(ys, next)}`;
  }
  return `${path}Z`;
};

const FRAME_RATE = 60;

export const LOBE_FRAMES = Math.round((CYCLE_MS / 1000) * FRAME_RATE);

export const LOBE_CYCLE_MS = CYCLE_MS;

const frameTime = (frame: number) => (frame * CYCLE_MS) / LOBE_FRAMES;

const LOBE_GROWTH =
  (REACH * LOBE_FRAMES) /
  Array.from({ length: LOBE_FRAMES }, (_, frame) => areaRadiusAt(frameTime(frame))).reduce((sum, radius) => sum + radius, 0);

export const LOBE_WINDOW = LOBE_GROWTH * CELL_ROOM;

const sprites = new Map<number, string>();

export const lobeSprite = (box: number): string => {
  const known = sprites.get(box);
  if (known) return known;
  const cell = box * LOBE_WINDOW;
  let paths = "";
  for (let frame = 0; frame < LOBE_FRAMES; frame++) {
    paths += `<path transform="translate(${(frame + 0.5) * cell} ${cell / 2}) scale(${LOBE_GROWTH})" d="${pathAt(frameTime(frame))}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOBE_FRAMES * cell} ${cell}" preserveAspectRatio="none">${paths}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  sprites.set(box, url);
  return url;
};

export const lobePhase = (): number => -(Number(document.timeline.currentTime ?? 0) % CYCLE_MS);
