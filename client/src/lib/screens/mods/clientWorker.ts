interface Driver {
  mount: (id: string, fn: unknown, props: unknown) => void;
  setProps: (id: string, props: unknown) => void;
  resize: (id: string, columns: number, rows: number) => void;
  stage: (id: string, kind: string, payload?: unknown) => void;
  dropHeld: (id: string, handles: number[]) => void;
  hasListener: (id: string, kind: "pointer" | "key") => boolean;
  unmount: (id: string) => void;
}

interface Runtime {
  h: unknown;
  Fragment: unknown;
  install: (host: unknown, limits: unknown) => Driver;
}

interface SourceFile {
  key: string;
  source: string;
}

type Phase = "load" | "render" | "run";

type Inbound =
  | { op: "load"; files: SourceFile[]; runtime: string; limits: unknown }
  | { op: "mount"; id: string; entry: string; component: string; props: unknown; columns: number; rows: number }
  | { op: "props"; id: string; props: unknown }
  | { op: "resize"; id: string; columns: number; rows: number }
  | { op: "pointer" | "key"; id: string; event: unknown }
  | { op: "held"; id: string; handle: number; event: unknown }
  | { op: "unmount"; id: string }
  | { op: "ping" };

const FRAME_MS = 16;
const LOOP_RENDERS = 3;
const SPECIFIER = /(\bfrom\s*|\bimport\s*)(["'])([^"'\n]+)\2/g;

const scope = self as unknown as {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent<Inbound>) => void) | null;
  requestAnimationFrame?: (run: () => void) => number;
  h?: unknown;
  Fragment?: unknown;
  __surface__?: { run: () => unknown };
};

const sources = new Map<string, string>();
const urls = new Map<string, string>();
const held = new Map<string, number[]>();
const loops = new Map<string, number>();
const scheduled = new Set<string>();
const timers = new Map<string, Set<ReturnType<typeof setInterval>>>();
let driver: Driver | null = null;
let rendering: string | null = null;
let flushing = false;

const nextFrame = (run: () => void) => {
  if (scope.requestAnimationFrame) scope.requestAnimationFrame(run);
  else queueMicrotask(run);
};

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const release = (id: string) => {
  for (const timer of timers.get(id) ?? []) clearInterval(timer);
  timers.delete(id);
  scheduled.delete(id);
  held.delete(id);
  loops.delete(id);
  driver?.unmount(id);
};

const fault = (id: string, phase: Phase, reason: string) => {
  scope.postMessage({ op: "fault", id, phase, reason });
  release(id);
};

const urlOf = (key: string, trail: Set<string> = new Set()): string => {
  const known = urls.get(key);
  if (known) return known;
  if (trail.has(key)) throw new Error(`a cycle of imports through ${key}`);
  const source = sources.get(key);
  if (source === undefined) throw new Error(`no file ${key}`);
  trail.add(key);
  const linked = source.replace(SPECIFIER, (match, lead: string, quote: string, specifier: string) =>
    sources.has(specifier) ? `${lead}${quote}${urlOf(specifier, trail)}${quote}` : match,
  );
  const url = URL.createObjectURL(new Blob([linked], { type: "text/javascript" }));
  urls.set(key, url);
  return url;
};

const call = (id: string, kind: string, payload?: unknown): unknown => {
  driver!.stage(id, kind, payload);
  return scope.__surface__?.run();
};

const handlesOf = (node: unknown, into: number[] = []): number[] => {
  if (node === null || typeof node !== "object") return into;
  const element = node as { held?: unknown; children?: unknown[] };
  if (typeof element.held === "number") into.push(element.held);
  for (const child of element.children ?? []) handlesOf(child, into);
  return into;
};

const render = (id: string) => {
  if (!driver) return;
  rendering = id;
  try {
    const json = call(id, "render");
    if (typeof json !== "string") return;
    const handles = handlesOf(JSON.parse(json));
    const kept = new Set(handles);
    const retired = (held.get(id) ?? []).filter((handle) => !kept.has(handle));
    if (retired.length) driver.dropHeld(id, retired);
    held.set(id, handles);
    scope.postMessage({
      op: "tree",
      id,
      json,
      pointer: driver.hasListener(id, "pointer"),
      key: driver.hasListener(id, "key"),
    });
  } catch (error) {
    fault(id, "render", reasonOf(error));
  } finally {
    rendering = null;
  }
};

const flushScheduled = () => {
  flushing = false;
  const ids = [...scheduled];
  scheduled.clear();
  for (const id of ids) render(id);
};

const schedule = (id: string) => {
  const looping = rendering === id ? (loops.get(id) ?? 0) + 1 : 0;
  loops.set(id, looping);
  if (looping >= LOOP_RENDERS) {
    fault(id, "run", "setState on every render: a render loop");
    return;
  }
  scheduled.add(id);
  if (flushing) return;
  flushing = true;
  nextFrame(flushScheduled);
};

const host = {
  schedule,
  startTimer: (id: string, interval: number) => {
    const timer: ReturnType<typeof setInterval> = setInterval(() => act(id, "tick", timer), Math.max(interval, FRAME_MS));
    timers.set(id, new Set([...(timers.get(id) ?? []), timer]));
    return timer;
  },
  stopTimer: (id: string, timer: ReturnType<typeof setInterval>) => {
    clearInterval(timer);
    timers.get(id)?.delete(timer);
  },
  post: (id: string, text: string) => scope.postMessage({ op: "post", id, text }),
  fault: (id: string, reason: string) => fault(id, "run", reason),
};

const act = (id: string, kind: string, payload?: unknown) => {
  loops.set(id, 0);
  try {
    call(id, kind, payload);
  } catch (error) {
    fault(id, "run", reasonOf(error));
  }
};

const load = async (message: Extract<Inbound, { op: "load" }>) => {
  for (const file of message.files) sources.set(file.key, file.source);
  const runtime = (await import(/* @vite-ignore */ urlOf(message.runtime))) as Runtime;
  scope.h = runtime.h;
  scope.Fragment = runtime.Fragment;
  driver = runtime.install(host, message.limits);
};

const mount = async (message: Extract<Inbound, { op: "mount" }>) => {
  try {
    const module = (await import(/* @vite-ignore */ urlOf(message.entry))) as Record<string, unknown>;
    const fn = message.component === "default" ? module.default : module[message.component];
    driver!.mount(message.id, fn, message.props);
    driver!.resize(message.id, message.columns, message.rows);
  } catch (error) {
    scope.postMessage({ op: "fault", id: message.id, phase: "load", reason: reasonOf(error) });
    return;
  }
  render(message.id);
};

const handle = async (message: Inbound) => {
  switch (message.op) {
    case "load":
      try {
        await load(message);
        scope.postMessage({ op: "ready" });
      } catch (error) {
        scope.postMessage({ op: "failed", reason: reasonOf(error) });
      }
      return;
    case "mount":
      await mount(message);
      return;
    case "props":
      driver?.setProps(message.id, message.props);
      loops.set(message.id, 0);
      render(message.id);
      return;
    case "resize":
      driver?.resize(message.id, message.columns, message.rows);
      loops.set(message.id, 0);
      render(message.id);
      return;
    case "pointer":
    case "key":
      act(message.id, message.op, message.event);
      return;
    case "held":
      act(message.id, "held", { handle: message.handle, event: message.event });
      return;
    case "unmount":
      release(message.id);
      return;
    case "ping":
      return;
  }
};

let queue: Promise<void> = Promise.resolve();

scope.onmessage = (event) => {
  queue = queue
    .then(() => handle(event.data))
    .catch((error) => scope.postMessage({ op: "failed", reason: reasonOf(error) }))
    .finally(() => scope.postMessage({ op: "idle" }));
};
