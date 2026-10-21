import { untrack } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import {
  emptyModState,
  toModCompletions,
  toModPromptBox,
  type ModAction,
  type ModActionFields,
  type ModChild,
  type ModCompletions,
  type ModComponent,
  type ModDrawn,
  type ModFillMode,
  type ModFocus,
  type ModNode,
  type ModPromptBox,
  type ModRenderSite,
  type ModRequest,
  type ModScroll,
  type ModState,
  type ModStroke,
  type ModToast,
} from "$lib/data/modModels";
import { store } from "$lib/platform/storage";
import { ModClients } from "./modClients.svelte";

export interface ModPort {
  render: (site: ModRenderSite, rid: number) => void;
  act: (action: ModAction, fields: ModActionFields, rid?: number) => void;
  answer: (id: string, answer: Record<string, unknown>) => void;
  clientModule: (plugin: string, rid: number) => void;
}

export interface ModHost {
  read: () => { text: string; cursor: number };
  fill: (text: string, mode: ModFillMode) => boolean;
  suggest: (text: string) => boolean;
  copy: (text: string) => Promise<boolean>;
  selection: () => string;
}

export const BAND_ID = "above-prompt";

const BAND_HIDDEN_KEY = "mods.bandHidden";

class BandState {
  hidden = $state(store.get(BAND_HIDDEN_KEY, false));

  toggle() {
    this.hidden = !this.hidden;
    store.set(BAND_HIDDEN_KEY, this.hidden);
  }
}

export const band = new BandState();

const TOAST_MS = 4000;
const REPLY_MS = 15000;

type Hooked = "probing" | boolean;

const keyOf = (component: ModComponent, instanceId: string) => `${component}:${instanceId}`;

const lastButton = (node: ModChild, hotkey: string): ModNode | null => {
  if (typeof node === "string") return null;
  let found = node.type === "Button" && node.press && node.props.hotkey === hotkey ? node : null;
  for (const child of node.children) found = lastButton(child, hotkey) ?? found;
  return found;
};

export class ModSurface {
  state = $state<ModState>(emptyModState());
  toasts = $state<ModToast[]>([]);
  suggestion = $state<string | null>(null);
  focusTarget = $state<ModFocus | null>(null);
  scrollTarget = $state<ModScroll | null>(null);
  raised = $state<string | null>(null);
  readonly hotScopes = new SvelteSet<string>();
  readonly clients: ModClients;
  host: ModHost | null = null;
  #drawn = $state<Record<string, ModDrawn>>({});
  #drawnColumns = $state<Record<string, number>>({});
  #sentColumns = new Map<string, number>();

  #mounted = new Map<string, ModRenderSite>();
  #signatures = new Map<string, string>();
  #latest = new Map<string, number>();
  #timers = new Map<number, ReturnType<typeof setTimeout>>();
  #hooked = new Map<ModComponent, Hooked>();
  #waiting = new Map<ModComponent, Set<string>>();
  #replies = new Map<number, (answer: unknown) => void>();
  #owed = new Set<string>();
  #redraw = new Set<string>();
  #onDrawn: (() => void)[] = [];
  #rid = 0;
  #toastId = 0;
  #seq = 0;
  #stale = false;

  constructor(private readonly port: ModPort) {
    this.clients = new ModClients(this);
  }

  readonly shown = $derived(
    this.state.panes.find((pane) => pane.id === this.state.shownId) ?? this.state.panes[0] ?? null,
  );

  get seq(): number {
    return this.#seq;
  }

  drawing(component: ModComponent, instanceId: string): ModDrawn | null {
    return this.#drawn[keyOf(component, instanceId)] ?? null;
  }

  tree(component: ModComponent, instanceId: string): ModNode | null {
    return this.drawing(component, instanceId)?.tree ?? null;
  }

  drawn(component: ModComponent, instanceId: string): boolean {
    return keyOf(component, instanceId) in this.#drawn;
  }

  drawnFor(component: ModComponent, instanceId: string, columns: number): boolean {
    return this.#drawnColumns[keyOf(component, instanceId)] === columns;
  }

  mount(site: ModRenderSite): () => void {
    const key = keyOf(site.component, site.instanceId);
    const signature = JSON.stringify(site);
    this.#mounted.set(key, site);
    untrack(() => {
      if (this.#signatures.get(key) === signature && key in this.#drawn) return;
      this.#signatures.set(key, signature);
      if (this.#owed.has(key)) this.#redraw.add(key);
      else this.#request(key);
    });
    return () => {
      if (this.#mounted.get(key) !== site) return;
      this.#mounted.delete(key);
      this.#signatures.delete(key);
      this.#waiting.get(site.component)?.delete(key);
    };
  }

  act(action: ModAction, fields: ModActionFields) {
    this.port.act(action, fields);
  }

  ask(action: ModAction, fields: ModActionFields): Promise<unknown> {
    return this.#reply((rid) => this.port.act(action, fields, rid));
  }

  clientModule(plugin: string): Promise<unknown> {
    return this.#reply((rid) => this.port.clientModule(plugin, rid));
  }

  async complete(text: string, cursor: number): Promise<ModCompletions | null> {
    if (!this.state.surface) return null;
    return toModCompletions(await this.ask("prompt_autocomplete", { text, cursor }), cursor);
  }

  async edit(text: string, cursor: number, stroke: ModStroke | null, by: "person" | "app"): Promise<ModPromptBox | null> {
    if (!this.state.surface) return null;
    return toModPromptBox(await this.ask("prompt_edit", { text, cursor, by, ...(stroke && { stroke }) }));
  }

  reply(rid: number, answer: unknown) {
    this.#replies.get(rid)?.(answer);
  }

  press(node: ModNode) {
    if (!node.press) return;
    const key = typeof node.props.key === "string" ? node.props.key : undefined;
    this.act("press", { ...node.press, key });
  }

  hotkey(component: ModComponent, instanceId: string, key: string): boolean {
    if (component === "AbovePrompt" && band.hidden) return false;
    const tree = this.tree(component, instanceId);
    const button = tree ? lastButton(tree, key.toLowerCase()) : null;
    if (button) this.press(button);
    return button !== null;
  }

  applyState(state: ModState) {
    const attached = state.surface && (this.#stale || !this.state.surface);
    this.#stale = false;
    this.state = state;
    this.clients.prune((site) => site.component !== "Pane" || state.panes.some((pane) => pane.id === site.instance_id));
    if (!state.surface) {
      this.#drawn = {};
      this.#hooked.clear();
      this.clients.reset();
    } else if (attached) this.invalidate();
  }

  invalidate() {
    this.#hooked.clear();
    this.#waiting.clear();
    for (const key of this.#mounted.keys()) this.#request(key);
  }

  seed(component: ModComponent, instanceId: string, drawn: ModDrawn) {
    this.#drawn[keyOf(component, instanceId)] = drawn;
    this.#hooked.set(component, true);
    this.clients.announce(drawn.clientModules);
  }

  receive(rid: number, component: ModComponent, instanceId: string, drawn: ModDrawn) {
    const key = keyOf(component, instanceId);
    if (this.#latest.get(key) !== rid) return;
    this.#drawn[key] = drawn;
    this.#drawnColumns[key] = this.#sentColumns.get(key) ?? 0;
    this.clients.announce(drawn.clientModules);
    if (this.#hooked.get(component) === "probing") {
      this.#hooked.set(component, drawn.hooked);
      const waiting = this.#waiting.get(component);
      this.#waiting.delete(component);
      if (drawn.hooked) for (const next of waiting ?? []) this.#request(next);
    }
    this.#owed.delete(key);
    if (this.#redraw.delete(key)) this.#request(key);
    if (!this.#owed.size) for (const resolve of this.#onDrawn.splice(0)) resolve();
  }

  whenDrawn(): Promise<void> {
    if (!this.#owed.size) return Promise.resolve();
    return new Promise((resolve) => this.#onDrawn.push(resolve));
  }

  focus(component: ModComponent, instanceId: string, plugin: string, key: string) {
    this.focusTarget = { component, instanceId, plugin, key, seq: ++this.#seq };
  }

  scroll(component: ModComponent, instanceId: string, offset: number, followEnd: boolean) {
    this.scrollTarget = { component, instanceId, offset, followEnd, seq: ++this.#seq };
  }

  async answer(request: ModRequest) {
    this.port.answer(request.id, await this.#answerFor(request));
  }

  async #answerFor(request: ModRequest): Promise<Record<string, unknown>> {
    const host = this.host;
    switch (request.kind) {
      case "prompt_fill":
        return { filled: host?.fill(request.text, request.mode) ?? false };
      case "prompt_suggest":
        return { shown: host?.suggest(request.text) ?? false };
      case "prompt_read":
        return host?.read() ?? { text: "", cursor: 0 };
      case "copy":
        return { copied: (await host?.copy(request.text)) ?? false };
      case "selection": {
        const text = host?.selection() ?? "";
        return text ? { text } : {};
      }
    }
  }

  toast(plugin: string | null, text: string, timeoutMs: number | null) {
    for (const old of this.toasts.filter((item) => item.plugin === plugin)) this.dismissToast(old.id);
    const id = ++this.#toastId;
    this.toasts = [...this.toasts, { id, plugin, text }];
    this.#timers.set(id, setTimeout(() => this.dismissToast(id), timeoutMs ?? TOAST_MS));
  }

  dismissToast(id: number) {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    this.toasts = this.toasts.filter((item) => item.id !== id);
  }

  rebind() {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    for (const resolve of this.#replies.values()) resolve(null);
    this.#timers.clear();
    this.#latest.clear();
    this.#signatures.clear();
    this.#hooked.clear();
    this.#waiting.clear();
    this.#replies.clear();
    this.toasts = [];
    this.suggestion = null;
    this.focusTarget = null;
    this.scrollTarget = null;
    this.hotScopes.clear();
    this.#owed.clear();
    this.#redraw.clear();
    this.#onDrawn = [];
    this.#stale = true;
  }

  reset() {
    this.rebind();
    this.#stale = false;
    this.#drawn = {};
    this.clients.reset();
    this.state = emptyModState();
  }

  #reply(send: (rid: number) => void): Promise<unknown> {
    const rid = ++this.#rid;
    return new Promise((resolve) => {
      const timer = setTimeout(() => settle(null), REPLY_MS);
      const settle = (answer: unknown) => {
        clearTimeout(timer);
        this.#replies.delete(rid);
        resolve(answer);
      };
      this.#replies.set(rid, settle);
      send(rid);
    });
  }

  #request(key: string) {
    const site = this.#mounted.get(key);
    if (!site || !this.state.surface) return;
    const hooked = this.#hooked.get(site.component);
    if (hooked === false) return;
    if (hooked === "probing") {
      if (this.#latest.has(key) && key in this.#drawn) this.#send(key, site);
      else this.#waiting.set(site.component, new Set([...(this.#waiting.get(site.component) ?? []), key]));
      return;
    }
    if (hooked === undefined) this.#hooked.set(site.component, "probing");
    this.#send(key, site);
  }

  #send(key: string, site: ModRenderSite) {
    const rid = ++this.#rid;
    this.#latest.set(key, rid);
    this.#sentColumns.set(key, site.columns);
    this.#owed.add(key);
    this.port.render(site, rid);
  }
}
