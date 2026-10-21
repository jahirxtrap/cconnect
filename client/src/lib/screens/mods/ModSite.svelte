<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { isEmptyTree, type ModComponent, type ModElement, type ModKeyed } from "$lib/data/modModels";
  import ModFit from "./ModFit.svelte";
  import { gridOf, provideGrid } from "./modGrid";
  import ModTree from "./ModTree.svelte";
  import type { ModSurface } from "./modSurface.svelte";

  interface Props {
    mods: ModSurface;
    component: ModComponent;
    instanceId: string;
    rows?: number | null;
    focused?: boolean;
    onFocusChange?: (focused: boolean) => void;
    onEscape?: (() => void) | null;
    pending?: Snippet;
    blank?: Snippet;
    class?: string;
    bodyClass?: string;
    flush?: boolean;
    thin?: boolean;
    edge?: string | null;
  }

  const {
    mods,
    component,
    instanceId,
    rows: fixedRows = null,
    focused = false,
    onFocusChange,
    onEscape = null,
    pending,
    blank,
    class: className = "",
    bodyClass = "",
    flush = false,
    thin = false,
    edge = null,
  }: Props = $props();

  const PROBE = "0000000000";
  const FIELDS = "input, textarea, select, [contenteditable], [aria-haspopup='listbox']";
  const FOCUSABLE = "button, input, textarea, select, [tabindex]";
  const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  const SCROLL_MS = 150;

  let root = $state<HTMLElement | null>(null);
  let body = $state<HTMLElement | null>(null);
  let probeWidth = $state(0);
  let cellHeight = $state(0);
  let width = $state(0);
  let viewHeight = $state(0);
  let padded = $state<HTMLElement | null>(null);
  let bodyInner = $state(0);
  let bodyOuter = $state(0);
  let padding = $state(0);
  let following = false;
  let offset = $state(0);

  const glyph = $derived(probeWidth / PROBE.length);
  const grid = $derived(gridOf(width, glyph, cellHeight));
  const columns = $derived(grid.columns);
  const cellWidth = $derived(grid.cell);
  const rows = $derived(
    fixedRows ?? (cellHeight ? Math.max(1, Math.floor((viewHeight - padding) / cellHeight)) : 0),
  );
  const tree = $derived(mods.tree(component, instanceId));
  const surface = $derived(mods.state.surface);
  const site = $derived({ component, instanceId });

  provideGrid(() => grid);

  $effect(() => {
    if (!surface || !columns || !rows) return;
    return mods.mount({ component, instanceId, props: {}, columns, rows, offset });
  });

  const sitePayload = () => ({ component, instance_id: instanceId });
  let reported: string | null = null;
  let shownOffset = 0;
  let expected: number | null = null;
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  let focusedSeq: number | null = null;
  let scrolledSeq: number | null = null;

  $effect.pre(() => {
    const start = untrack(() => mods.seq);
    focusedSeq ??= start;
    scrolledSeq ??= start;
  });

  const marked = (node: Element | null) => node?.closest<HTMLElement>("[data-mod-key][data-mod-plugin]") ?? null;

  const elementOf = (node: HTMLElement | null): ModElement | null =>
    node ? { plugin: node.dataset.modPlugin ?? "", key: node.dataset.modKey ?? "" } : null;

  const focusable = (node: HTMLElement) =>
    node.matches(FOCUSABLE) ? node : (node.querySelector<HTMLElement>(FOCUSABLE) ?? node);

  const holdsKeys = () => !!root && root.contains(document.activeElement);

  const report = (held: boolean, node: HTMLElement | null, by: "person" | "auto") => {
    const element = held ? elementOf(node) : null;
    const signature = held ? `${element?.plugin}:${element?.key}` : null;
    if (signature === reported) return;
    reported = signature;
    mods.act("site_focus", { ...sitePayload(), is_held: held, ...(held ? { element } : {}), by });
  };

  let moving: "auto" | null = null;

  const moveTo = (node: HTMLElement | null, by: "auto") => {
    if (!node) return;
    moving = by;
    focusable(node).focus({ preventScroll: true });
    moving = null;
  };

  const scrollTo = (top: number) => {
    if (!body) return;
    expected = Math.round(Math.min(top, body.scrollHeight - body.clientHeight));
    body.scrollTop = top;
  };

  $effect(() => {
    const target = mods.focusTarget;
    if (!target || target.seq <= (focusedSeq ?? Infinity) || target.component !== component || target.instanceId !== instanceId)
      return;
    focusedSeq = target.seq;
    if (!root || !holdsKeys()) return;
    const node = root.querySelector<HTMLElement>(`[data-mod-key="${CSS.escape(target.key)}"]`);
    if (!node) return;
    reported = `${target.plugin}:${target.key}`;
    focusable(node).focus();
  });

  $effect(() => {
    const target = mods.scrollTarget;
    if (!target || target.seq <= (scrolledSeq ?? Infinity) || target.component !== component || target.instanceId !== instanceId)
      return;
    scrolledSeq = target.seq;
    if (!body) return;
    following = target.followEnd;
    scrollTo(following ? body.scrollHeight : target.offset * cellHeight);
  });

  $effect(() => {
    void tree;
    if (!body || !root) return;
    if (following) scrollTo(body.scrollHeight);
    if (document.activeElement === root) moveTo(root.querySelector<HTMLElement>("[data-mod-autofocus]"), "auto");
  });

  $effect(() => {
    const idle = !document.activeElement || document.activeElement === document.body;
    if (focused && root && idle) root.focus({ preventScroll: true });
  });

  $effect(() => {
    if (!padded) return;
    const style = getComputedStyle(padded);
    padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  });

  $effect(() => () => clearTimeout(scrollTimer));

  const release = () => {
    following = false;
  };

  const keyedRows = (): ModKeyed[] => {
    if (!body || !cellHeight) return [];
    const top = body.getBoundingClientRect().top - body.scrollTop;
    return [...body.querySelectorAll<HTMLElement>("[data-mod-key][data-mod-plugin]")].map((node) => {
      const box = node.getBoundingClientRect();
      return {
        ...elementOf(node)!,
        top: Math.max(0, Math.floor((box.top - top) / cellHeight)),
        bottom: Math.max(0, Math.ceil((box.bottom - top) / cellHeight)),
      };
    });
  };

  const onscroll = () => {
    if (!body) return;
    if (expected !== null && Math.abs(body.scrollTop - expected) <= 1) {
      expected = null;
      return;
    }
    expected = null;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (!body || !cellHeight) return;
      const at = Math.round(body.scrollTop / cellHeight);
      offset = at;
      mods.act("site_scroll", {
        ...sitePayload(),
        offset: at,
        by: at - shownOffset,
        body_rows: Math.floor(body.clientHeight / cellHeight),
        content_rows: Math.ceil(body.scrollHeight / cellHeight),
        keyed: keyedRows(),
      });
      shownOffset = at;
    }, SCROLL_MS);
  };

  const onkeydown = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest(FIELDS)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (onEscape) onEscape();
      else root?.blur();
      return;
    }
    if (SCROLL_KEYS.has(event.key)) release();
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    if (mods.hotkey(component, instanceId, event.key)) event.preventDefault();
  };

  const onfocusin = (event: FocusEvent) => {
    onFocusChange?.(true);
    report(true, marked(event.target as Element), moving ?? "person");
  };

  const onfocusout = (event: FocusEvent) => {
    if (root?.contains(event.relatedTarget as Node | null)) return;
    onFocusChange?.(false);
    report(false, null, "person");
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  bind:this={root}
  data-mod-site=""
  tabindex="-1"
  role="group"
  {onkeydown}
  {onfocusin}
  {onfocusout}
  style={cellWidth ? `--mod-cell: ${cellWidth}px; --mod-line: ${cellHeight}px` : undefined}
  class="relative flex min-h-0 flex-col text-body-md text-on-surface outline-none {className}"
>
  <span
    aria-hidden="true"
    bind:clientWidth={probeWidth}
    bind:clientHeight={cellHeight}
    class="pointer-events-none invisible absolute top-0 left-0 font-mono whitespace-pre">{PROBE}</span
  >
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={body}
    bind:clientHeight={viewHeight}
    bind:clientWidth={bodyInner}
    bind:offsetWidth={bodyOuter}
    style={[
      fixedRows ? `max-height: calc(${fixedRows} * var(--mod-line, 1lh))` : "",
      edge ? "scrollbar-gutter: stable" : "",
    ]
      .filter(Boolean)
      .join("; ") || undefined}
    {onscroll}
    onwheel={release}
    ontouchmove={release}
    onpointerdown={(event) => {
      if (event.target === body) release();
    }}
    class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto {thin ? 'scrollbar-thin' : ''}"
  >
    <div
      bind:this={padded}
      style={edge ? `padding-right: max(0px, calc(${edge} - ${bodyOuter - bodyInner}px))` : undefined}
      class="flex min-h-full flex-col {bodyClass}"
    >
      <div bind:clientWidth={width} class="flex min-w-0 flex-1 flex-col">
        {#if tree && !isEmptyTree(tree)}
          <ModFit room={width} watch={tree} fresh={mods.drawnFor(component, instanceId, columns)}><ModTree node={tree} {mods} {site} {flush} /></ModFit>
        {:else if mods.drawn(component, instanceId)}
          {@render blank?.()}
        {:else}
          {@render pending?.()}
        {/if}
      </div>
    </div>
  </div>
</div>
