<script lang="ts">
  import { untrack } from "svelte";
  import { clientKeyOf, type ModComponent, type ModNode } from "$lib/data/modModels";
  import { t } from "$lib/i18n/index.svelte";
  import { typingOnTouch } from "$lib/ui/keepFocus";
  import type { ClientInstance, ClientKey, ClientPointer } from "./modClients.svelte";
  import { siteGrid, siteScale } from "./modGrid";
  import ModTree from "./ModTree.svelte";
  import type { ModSurface } from "./modSurface.svelte";

  interface Props {
    mods: ModSurface;
    site: { component: ModComponent; instanceId: string };
    node: ModNode;
  }

  const { mods, site, node }: Props = $props();

  const BUTTONS: Record<number, ClientPointer["button"]> = { 0: "left", 1: "middle", 2: "right" };
  const HELD: Array<[number, number]> = [
    [1, 0],
    [2, 2],
    [4, 1],
  ];
  const PERCENT = /^\d{1,3}%$/;
  const cells = siteGrid();
  const scale = siteScale();

  let region = $state<HTMLElement | null>(null);
  let instance = $state<ClientInstance | null>(null);
  let width = $state(0);
  let height = $state(0);
  let last = { x: 0, y: 0 };
  let moved: PointerEvent | null = null;
  let frame = 0;

  const plugin = $derived(node.client ?? node.owner ?? "");
  const key = $derived(typeof node.props.key === "string" ? node.props.key : "");
  const module = $derived(typeof node.props.module === "string" ? node.props.module : "");
  const handed = $derived(node.props.props);
  const signature = $derived(JSON.stringify(handed ?? null));

  const size = (value: unknown, unit: string): string | null =>
    typeof value === "number" && Number.isFinite(value)
      ? `calc(${value} * ${unit})`
      : typeof value === "string" && PERCENT.test(value)
        ? value
        : null;

  const regionStyle = $derived(
    [
      size(node.props.width, "var(--mod-cell, 1ch)") && `width: ${size(node.props.width, "var(--mod-cell, 1ch)")}`,
      size(node.props.height, "var(--mod-line, 1lh)") && `height: ${size(node.props.height, "var(--mod-line, 1lh)")}`,
      typeof node.props.flexGrow === "number" && `flex-grow: ${node.props.flexGrow}`,
    ]
      .filter(Boolean)
      .join("; "),
  );


  const port = $derived({
    press: (target: ModNode) => void instance?.trigger(target, { type: "press" }),
    input: (target: ModNode, kind: "change" | "submit", value: string) =>
      void instance?.trigger(target, { type: "input", kind, value }),
    select: (target: ModNode, value: string) => void instance?.trigger(target, { type: "select", value }),
  });

  $effect(() => {
    if (!plugin || !key || !module) return;
    const made = mods.clients.mount(
      { plugin, component: site.component, instance_id: site.instanceId, client: key, module },
      untrack(() => $state.snapshot(handed)),
    );
    instance = made;
    return () => {
      if (instance === made) instance = null;
    };
  });

  $effect(() => {
    void signature;
    const current = untrack(() => instance);
    current?.setProps(untrack(() => $state.snapshot(handed)));
  });

  $effect(() => {
    const { cell, line } = cells();
    if (!instance || !cell || !line) return;
    instance.resize(
      typeof node.props.width === "number" ? node.props.width : Math.floor(width / cell),
      typeof node.props.height === "number" ? node.props.height : Math.floor(height / line),
    );
  });

  const cellOf = (event: PointerEvent) => {
    const { cell, line } = cells();
    const box = region!.getBoundingClientRect();
    const x = (event.clientX - box.left) / (cell * scale());
    const y = (event.clientY - box.top) / (line * scale());
    last = { x: Math.floor(x), y: Math.floor(y) };
    return { ...last, fine: { x, y } };
  };

  const modifiers = (event: PointerEvent | KeyboardEvent) => ({
    ...(event.shiftKey && { shift: true as const }),
    ...(event.altKey && { alt: true as const }),
    ...(event.ctrlKey && { ctrl: true as const }),
  });

  const pointer = (type: ClientPointer["type"], event: PointerEvent, button?: number) => {
    if (type !== "move") flush();
    if (!instance?.listensPointer || !region || !cells().cell) return;
    const at = type === "enter" || type === "leave" ? last : cellOf(event);
    instance.pointer({
      type,
      ...at,
      ...(button !== undefined && BUTTONS[button] && { button: BUTTONS[button] }),
      ...modifiers(event),
    });
  };

  const held = (buttons: number) => HELD.find(([mask]) => buttons & mask)?.[1];

  const flush = () => {
    cancelAnimationFrame(frame);
    const event = moved;
    moved = null;
    if (event) pointer("move", event, held(event.buttons));
  };

  const onpointermove = (event: PointerEvent) => {
    if (!moved) frame = requestAnimationFrame(flush);
    moved = event;
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (!instance) return;
    if (event.key === "Escape") {
      event.preventDefault();
      region?.blur();
      return;
    }
    const sent: ClientKey | null = clientKeyOf(event);
    if (!sent) return;
    if (instance.key(sent)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<div
  bind:this={region}
  bind:clientWidth={width}
  bind:clientHeight={height}
  tabindex="0"
  style={regionStyle}
  class="relative min-h-0 min-w-0 shrink-0 overflow-hidden outline-none {instance?.listensPointer
    ? 'touch-none'
    : ''}"
  {onkeydown}
  onpointerdown={(event) => {
    if (instance?.listensPointer) {
      event.preventDefault();
      if (!typingOnTouch()) region?.focus();
      region?.setPointerCapture(event.pointerId);
    }
    pointer("down", event, event.button);
  }}
  oncontextmenu={(event) => {
    if (instance?.listensPointer) event.preventDefault();
  }}
  {onpointermove}
  onpointerup={(event) => pointer("up", event, event.button)}
  onpointerenter={(event) => pointer("enter", event)}
  onpointerleave={(event) => pointer("leave", event)}
>
  {#if instance?.fault}
    <span class="font-sans text-body-sm text-on-surface-variant" title={instance.fault}>{t("MOD_CLIENT_FAILED")}</span>
  {:else if instance?.tree}
    <ModTree node={instance.tree} {mods} {site} {port} />
  {/if}
</div>
