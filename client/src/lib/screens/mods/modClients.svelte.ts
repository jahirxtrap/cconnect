import { toModNode, type ModClientEvent, type ModComponent, type ModNode } from "$lib/data/modModels";
import type { ModSurface } from "./modSurface.svelte";

export interface ClientSite {
  plugin: string;
  component: ModComponent;
  instance_id: string;
  client: string;
  module: string;
}

export interface ClientPointer {
  type: "down" | "move" | "up" | "enter" | "leave";
  x: number;
  y: number;
  fine?: { x: number; y: number };
  button?: "left" | "middle" | "right";
  shift?: true;
  alt?: true;
  ctrl?: true;
}

export interface ClientKey {
  key: string;
  ctrl?: true;
  shift?: true;
  meta?: true;
}

interface Bundle {
  hash: string;
  modules: { module: string; entry: string; component: string }[];
  runtime: string;
  limits: unknown;
  files: { key: string; source: string }[];
}

interface Outbound {
  op: "tree" | "post" | "fault" | "ready" | "failed" | "idle";
  id?: string;
  json?: string;
  text?: string;
  phase?: "load" | "render" | "run";
  reason?: string;
  pointer?: boolean;
  key?: boolean;
}

const BUDGET_MS = 2000;
const PING_MS = 1000;

const isBundle = (value: unknown): value is Bundle => {
  const bundle = value as Bundle | null;
  return (
    !!bundle &&
    typeof bundle.hash === "string" &&
    Array.isArray(bundle.modules) &&
    Array.isArray(bundle.files) &&
    typeof bundle.runtime === "string"
  );
};

export class ClientInstance {
  tree = $state<ModNode | null>(null);
  fault = $state<string | null>(null);
  listensPointer = $state(false);
  listensKey = $state(false);
  #frame: Frame | null = null;
  #props: unknown;
  #columns = 0;
  #rows = 0;

  constructor(
    readonly id: string,
    readonly site: ClientSite,
    private readonly mods: ModSurface,
    props: unknown,
  ) {
    this.#props = props;
  }

  attach(frame: Frame) {
    this.#frame = frame;
    this.tree = null;
    this.fault = null;
    const entry = frame.entryOf(this.site.module);
    if (!entry) {
      this.failed("load", `no surface module ${this.site.module}`);
      return;
    }
    frame.send({ op: "mount", id: this.id, ...entry, props: this.#props, columns: this.#columns, rows: this.#rows });
  }

  detach() {
    this.#frame = null;
  }

  failed(phase: "load" | "render" | "run", reason: string) {
    this.fault = reason || "the module failed without a message";
    this.mods.act("client_fault", { ...this.site, phase, reason: this.fault.slice(0, 200) });
  }

  drawn(json: string, pointer: boolean, key: boolean) {
    this.listensPointer = pointer;
    this.listensKey = key;
    try {
      this.tree = toModNode(JSON.parse(json), this.site.plugin);
    } catch {
      this.tree = null;
    }
  }

  setProps(props: unknown) {
    this.#props = props;
    this.#frame?.send({ op: "props", id: this.id, props });
  }

  resize(columns: number, rows: number) {
    if (columns === this.#columns && rows === this.#rows) return;
    this.#columns = columns;
    this.#rows = rows;
    this.#frame?.send({ op: "resize", id: this.id, columns, rows });
  }

  pointer(event: ClientPointer) {
    if (this.listensPointer) this.#frame?.send({ op: "pointer", id: this.id, event });
  }

  key(event: ClientKey): boolean {
    if (!this.listensKey) return false;
    this.#frame?.send({ op: "key", id: this.id, event });
    return true;
  }

  async trigger(node: ModNode, event: ModClientEvent) {
    const handle = node.press?.handle;
    const element = typeof node.props.key === "string" ? node.props.key : null;
    if (typeof handle !== "number" || !element) return;
    const answer = (await this.mods.ask("client_press", { ...this.site, element, event })) as {
      handled?: boolean;
      reached?: unknown;
    } | null;
    if (answer?.handled && answer.reached !== undefined) {
      this.#frame?.send({ op: "held", id: this.id, handle, event: answer.reached });
    }
  }

  async posted(text: string) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return;
    }
    const answer = (await this.mods.ask("client_message", { ...this.site, data })) as {
      handled?: boolean;
      props?: unknown;
    } | null;
    if (answer?.handled && answer.props !== undefined) this.setProps(answer.props);
  }
}

class Frame {
  readonly worker: Worker;
  readonly instances = new Map<string, ClientInstance>();
  #modules: Bundle["modules"] = [];
  #ready = false;
  #outstanding = 0;
  #progress = 0;
  #watchdog: ReturnType<typeof setInterval>;

  constructor(
    readonly plugin: string,
    readonly hash: string,
    private readonly onHung: (frame: Frame) => void,
  ) {
    this.worker = new Worker(new URL("./clientWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<Outbound>) => this.#receive(event.data);
    this.#watchdog = setInterval(() => this.#check(), PING_MS);
  }

  load(bundle: Bundle) {
    this.#modules = bundle.modules;
    this.send({ op: "load", files: bundle.files, runtime: bundle.runtime, limits: bundle.limits });
  }

  entryOf(module: string) {
    const found = this.#modules.find((entry) => entry.module === module || `./${entry.module}` === module);
    return found ? { entry: found.entry, component: found.component } : null;
  }

  add(instance: ClientInstance) {
    this.instances.set(instance.id, instance);
    if (this.#ready) instance.attach(this);
  }

  remove(id: string) {
    this.instances.get(id)?.detach();
    this.instances.delete(id);
    this.send({ op: "unmount", id });
  }

  send(message: Record<string, unknown>) {
    if (this.#outstanding === 0) this.#progress = performance.now();
    this.#outstanding += 1;
    this.worker.postMessage(message);
  }

  close() {
    clearInterval(this.#watchdog);
    this.worker.terminate();
    for (const instance of this.instances.values()) instance.detach();
  }

  #check() {
    if (this.#outstanding > 0 && performance.now() - this.#progress > BUDGET_MS) {
      this.onHung(this);
      return;
    }
    if (this.instances.size) this.send({ op: "ping" });
  }

  #receive(message: Outbound) {
    const instance = message.id ? this.instances.get(message.id) : undefined;
    switch (message.op) {
      case "idle":
        this.#outstanding = Math.max(0, this.#outstanding - 1);
        this.#progress = performance.now();
        return;
      case "ready":
        this.#ready = true;
        for (const item of this.instances.values()) item.attach(this);
        return;
      case "failed":
        for (const item of this.instances.values()) item.failed("load", message.reason ?? "");
        return;
      case "tree":
        instance?.drawn(message.json ?? "", message.pointer === true, message.key === true);
        return;
      case "post":
        void instance?.posted(message.text ?? "");
        return;
      case "fault":
        instance?.failed(message.phase ?? "run", message.reason ?? "");
    }
  }
}

export class ModClients {
  #hashes = new Map<string, string>();
  #frames = new Map<string, Frame>();
  #loading = new Map<string, Promise<Frame | null>>();
  #instances = new Map<string, ClientInstance>();

  constructor(private readonly mods: ModSurface) {}

  announce(modules: Record<string, string>) {
    for (const [plugin, hash] of Object.entries(modules)) {
      const before = this.#hashes.get(plugin);
      this.#hashes.set(plugin, hash);
      const frame = this.#frames.get(plugin);
      if (before !== undefined && before !== hash && frame && frame.hash !== hash) this.#reload(frame);
    }
  }

  mount(site: ClientSite, props: unknown): ClientInstance {
    const id = `${site.component}\u0000${site.instance_id}\u0000${site.client}`;
    const kept = this.#instances.get(id);
    if (kept && kept.site.module === site.module) return kept;
    if (kept) this.unmount(kept);
    const instance = new ClientInstance(id, site, this.mods, props);
    this.#instances.set(id, instance);
    void this.#frameFor(site.plugin).then((frame) => {
      if (!frame) {
        instance.failed("load", `${site.plugin} serves no surface module`);
        return;
      }
      if (this.#instances.get(id) === instance) frame.add(instance);
    });
    return instance;
  }

  unmount(instance: ClientInstance) {
    if (this.#instances.get(instance.id) !== instance) return;
    this.#instances.delete(instance.id);
    this.#frames.get(instance.site.plugin)?.remove(instance.id);
  }

  prune(keeps: (site: ClientSite) => boolean) {
    for (const instance of [...this.#instances.values()]) if (!keeps(instance.site)) this.unmount(instance);
  }

  reset() {
    for (const frame of this.#frames.values()) frame.close();
    this.#frames.clear();
    this.#loading.clear();
    this.#hashes.clear();
    this.#instances.clear();
  }

  #frameFor(plugin: string): Promise<Frame | null> {
    const frame = this.#frames.get(plugin);
    if (frame) return Promise.resolve(frame);
    const loading = this.#loading.get(plugin);
    if (loading) return loading;
    const next = this.mods.clientModule(plugin).then((bundle) => {
      this.#loading.delete(plugin);
      if (!isBundle(bundle)) return null;
      const made = new Frame(plugin, bundle.hash, (hung) => this.#hung(hung));
      made.load(bundle);
      this.#frames.set(plugin, made);
      return made;
    });
    this.#loading.set(plugin, next);
    return next;
  }

  #reload(frame: Frame) {
    const instances = [...frame.instances.values()];
    frame.close();
    this.#frames.delete(frame.plugin);
    void this.#frameFor(frame.plugin).then((next) => {
      for (const instance of instances) {
        if (this.#instances.get(instance.id) !== instance) continue;
        if (next) next.add(instance);
        else instance.failed("load", `${frame.plugin} serves no surface module`);
      }
    });
  }

  #hung(frame: Frame) {
    const instances = [...frame.instances.values()];
    frame.close();
    this.#frames.delete(frame.plugin);
    for (const instance of instances) instance.failed("run", "the module ran past its time and was stopped");
  }
}
