<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import type { ModChild, ModComponent, ModNode } from "$lib/data/modModels";
  import { t } from "$lib/i18n/index.svelte";
  import { openExternal } from "$lib/platform";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ModClient from "./ModClient.svelte";
  import ModCode from "./ModCode.svelte";
  import {
    blockStyle,
    borderOf,
    boxStyle,
    middleCut,
    svgSource,
    textRuns,
    textStyle,
    unpadded,
    wrapOf,
    type ButtonRow,
    type Wrap,
  } from "./modStyle";
  import type { ModSurface } from "./modSurface.svelte";
  import { DIM, modColor } from "./modTheme";

  interface Port {
    press: (node: ModNode) => void;
    input: (node: ModNode, kind: "change" | "submit", value: string) => void;
    select: (node: ModNode, value: string) => void;
  }

  interface Props {
    node: ModNode;
    mods: ModSurface;
    site: { component: ModComponent; instanceId: string };
    port?: Port;
    engine?: Snippet;
    flush?: boolean;
  }

  const { node, mods, site, port: given, engine, flush = false }: Props = $props();

  interface Context {
    box: string | null;
    inText: boolean;
    edge: boolean;
  }

  const ROOT: Context = { box: null, inText: false, edge: false };
  const WRAP_CLASS: Record<Wrap, string> = {
    wrap: "whitespace-pre-wrap wrap-anywhere",
    end: "overflow-hidden text-ellipsis whitespace-pre",
    start: "overflow-hidden text-ellipsis whitespace-pre [direction:rtl] text-left",
    middle: "overflow-hidden whitespace-pre",
  };
  const BLOCK_CLASS = "inline-block h-[1lh] overflow-hidden align-top whitespace-pre [-webkit-text-fill-color:transparent]";
  const BUTTON_CLASS =
    "ripple flex max-w-full shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-md px-2.5 py-1 text-label-md whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-40";
  const BUTTON_LOOK = {
    primary: "bg-accent text-on-accent",
    secondary: "bg-surface-variant",
  };
  const PLAIN_CLASS =
    "ripple flex max-w-full shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-sm whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-40";
  const KEYCAP_CLASS =
    "inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-sm border border-outline-variant bg-surface-variant px-1 font-mono text-label-sm leading-none text-on-surface-variant uppercase";

  const FIELD_CLASS =
    "min-h-8 min-w-[12ch] flex-1 resize-none rounded-md border border-outline-variant bg-surface px-2.5 py-1 text-on-surface outline-none placeholder:text-on-surface-variant focus:border-accent disabled:opacity-40";
  const FIELD_BUTTON_CLASS =
    "ripple flex h-8 shrink-0 cursor-pointer items-center rounded-md bg-surface-variant px-3 text-label-md whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-40";

  const hotBoxes = new SvelteSet<string>();
  let drafts = $state<Record<string, string>>({});
  let openMenu = $state<string | null>(null);

  const prop = (item: ModNode, key: string): string | null =>
    typeof item.props[key] === "string" ? (item.props[key] as string) : null;

  const count = (item: ModNode, key: string): number | undefined =>
    typeof item.props[key] === "number" ? (item.props[key] as number) : undefined;

  const target = (item: ModNode) => ({ ...item.press!, key: prop(item, "key") ?? undefined });

  const hooksPort: Port = {
    press: (item) => void mods.press(item, site),
    input: (item, kind, value) => mods.act("input", { ...target(item), kind, value }),
    select: (item, value) => mods.act("select", { ...target(item), value }),
  };

  const port = $derived(given ?? hooksPort);

  const scopeOf = (item: ModNode): string | null =>
    typeof item.hover?.scope === "string" ? `${item.owner ?? ""}\u0000${item.hover.scope}` : null;

  const boxId = (item: ModNode): string | null => {
    const key = item.props.key;
    return typeof key === "string" || typeof key === "number" ? `${item.owner ?? ""}\u0000${key}` : null;
  };

  const hot = (item: ModNode, box: string | null): boolean => {
    const scope = scopeOf(item);
    return scope ? mods.hotScopes.has(scope) : box !== null && hotBoxes.has(box);
  };

  const shown = (item: ModNode, box: string | null): Record<string, unknown> => {
    if (!item.hover || !hot(item, box)) return item.props;
    const { scope: _scope, ...hover } = item.hover;
    return { ...item.props, ...hover };
  };

  const pointer = (item: ModNode, own: string | null) => {
    const scope = scopeOf(item);
    if (!own && !scope) return {};
    return {
      onpointerenter: () => {
        if (own) hotBoxes.add(own);
        if (scope) mods.hotScopes.add(scope);
      },
      onpointerleave: () => {
        if (own) hotBoxes.delete(own);
        if (scope) mods.hotScopes.delete(scope);
      },
    };
  };

  const marks = (item: ModNode) => {
    const key = prop(item, "key");
    return {
      "data-mod-key": key ?? undefined,
      "data-mod-plugin": key ? (item.press?.plugin ?? item.owner ?? undefined) : undefined,
      "data-mod-autofocus": item.props.autoFocus ? "" : undefined,
    };
  };

  const buttonRow = (item: ModNode, props: Record<string, unknown>): ButtonRow => {
    if (props.flexDirection === "column" || props.flexDirection === "column-reverse") return null;
    const kids = item.children.filter((kid) => typeof kid !== "string" || kid.trim());
    const buttons = kids.filter((kid) => typeof kid !== "string" && kid.type === "Button").length;
    return buttons === 0 ? null : buttons === kids.length ? "chips" : "mixed";
  };

  const plainText = (item: ModNode): string | null =>
    item.children.every((kid) => typeof kid === "string") ? (item.children as string[]).join("") : null;

  const draftKey = (item: ModNode) => `${item.press?.plugin}:${prop(item, "key")}`;

  const fieldValue = (item: ModNode) => drafts[draftKey(item)] ?? prop(item, "value") ?? "";

  const type = (item: ModNode, value: string) => {
    drafts[draftKey(item)] = value;
    if (item.press) port.input(item, "change", value);
  };

  const submit = (item: ModNode) => {
    if (!item.press) return;
    const key = draftKey(item);
    const value = fieldValue(item);
    delete drafts[key];
    port.input(item, "submit", value);
  };

  const fieldKeydown = (item: ModNode, event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submit(item);
  };

  const optionsOf = (item: ModNode) =>
    (Array.isArray(item.props.options) ? (item.props.options as Record<string, unknown>[]) : [])
      .filter((option) => typeof option?.value === "string")
      .map((option) => ({
        value: option.value as string,
        label: typeof option.label === "string" ? option.label : (option.value as string),
      }));

  const buttonStyle = (props: Record<string, unknown>) => {
    const color = modColor(props.color);
    const background = modColor(props.backgroundColor);
    return [
      color ? `color: ${color}` : props.dimColor ? `color: ${DIM}` : "",
      background ? `background-color: ${background}` : "",
    ]
      .filter(Boolean)
      .join("; ");
  };

  const pressButton = (event: MouseEvent, item: ModNode) => {
    (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-mod-site]")?.focus({ preventScroll: true });
    port.press(item);
  };

  const linkPress = (item: ModNode, event: MouseEvent) => {
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !item.press) return;
    const href = anchor.getAttribute("href") ?? "";
    const listed = Array.isArray(item.props.pressableLinks) ? (item.props.pressableLinks as unknown[]) : null;
    if (listed && !listed.includes(href)) return;
    event.preventDefault();
    event.stopPropagation();
    void mods.press(item, site, href);
  };

  const middle = (span: HTMLElement, text: string) => {
    let current = text;
    const fit = () => {
      span.textContent = current;
      if (span.scrollWidth <= span.clientWidth) return;
      const glyphs = [...current].length;
      let low = 1;
      let high = glyphs - 1;
      while (low < high) {
        const room = Math.ceil((low + high) / 2);
        span.textContent = middleCut(current, room);
        if (span.scrollWidth <= span.clientWidth) low = room;
        else high = room - 1;
      }
      span.textContent = middleCut(current, low);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(span.parentElement ?? span);
    fit();
    return {
      update(next: string) {
        current = next;
        fit();
      },
      destroy: () => observer.disconnect(),
    };
  };
</script>

{#snippet children(item: ModNode, ctx: Context)}{#each item.children as kid, index (index)}{@render render(kid, ctx)}{/each}{/snippet}

{#snippet label(item: ModNode, ctx: Context)}{#if prop(item, "label") !== null && item.children.every((kid) => typeof kid === "string")}{prop(
      item,
      "label",
    )}{:else}{@render children(item, { ...ctx, inText: true })}{/if}{/snippet}

{#snippet render(child: ModChild, ctx: Context)}
  {#if typeof child === "string"}
    {#each textRuns(child) as run, index (index)}{#if run.fill}<span class={BLOCK_CLASS} style={blockStyle(run)}
          >{run.text}</span
        >{:else}{run.text}{/if}{/each}
  {:else if child.type === "Box"}
    {@const own = boxId(child)}
    {@const drawn = shown(child, own ?? ctx.box)}
    {@const bare = ctx.edge && !borderOf(drawn)}
    {@const props = bare ? unpadded(drawn) : drawn}
    <div style={boxStyle(props, buttonRow(child, props))} class="min-h-0 min-w-0" {...marks(child)} {...pointer(child, own)}>
      {@render children(child, { ...ctx, box: own ?? ctx.box, edge: bare && props.flexDirection === "column" })}
    </div>
  {:else if child.type === "Text"}
    {@const props = shown(child, ctx.box)}
    {@const wrap = ctx.inText ? null : wrapOf(props)}
    {@const inner = { ...ctx, inText: true }}
    {#if wrap === "start"}
      <span style={textStyle(props)} class="min-w-0 {WRAP_CLASS.start}" {...pointer(child, null)}
        ><bdi class="[direction:ltr] [unicode-bidi:isolate]">{@render children(child, inner)}</bdi></span
      >
    {:else if wrap === "middle" && plainText(child) !== null}
      <span
        style={textStyle(props)}
        class="min-w-0 {WRAP_CLASS.middle}"
        use:middle={plainText(child) ?? ""}
        {...pointer(child, null)}
      ></span>
    {:else}
      <span
        style={textStyle(props)}
        class="min-w-0 {wrap ? WRAP_CLASS[wrap === 'middle' ? 'end' : wrap] : ''}"
        {...pointer(child, null)}>{@render children(child, inner)}</span
      >
    {/if}
  {:else if child.type === "Button"}
    {@const props = shown(child, ctx.box)}
    {@const hotkey = prop(child, "hotkey")}
    {#if props.role === "dismiss"}
      <TooltipIconButton
        label={prop(child, "label") ?? t("CLOSE")}
        class="ml-auto size-7 shrink-0 self-start"
        onclick={() => child.press && port.press(child)}
      >
        <X />
      </TooltipIconButton>
    {:else if props.plain}
      <button
        type="button"
        class={PLAIN_CLASS}
        style={buttonStyle(props)}
        disabled={child.press === null}
        {...marks(child)}
        {...pointer(child, null)}
        onclick={(event) => pressButton(event, child)}
      >
        {#if hotkey}<kbd class={KEYCAP_CLASS}>{hotkey}</kbd>{/if}<span class="min-w-0 truncate"
          >{@render label(child, ctx)}</span
        >
      </button>
    {:else}
      <button
        type="button"
        class="{BUTTON_CLASS} {props.variant === 'primary' ? BUTTON_LOOK.primary : BUTTON_LOOK.secondary}"
        style={buttonStyle(props)}
        disabled={child.press === null}
        {...marks(child)}
        {...pointer(child, null)}
        onclick={(event) => pressButton(event, child)}
      >
        {#if hotkey}<kbd class={KEYCAP_CLASS}>{hotkey}</kbd>{/if}<span class="min-w-0 truncate"
          >{@render label(child, ctx)}</span
        >
      </button>
    {/if}
  {:else if child.type === "Link"}
    {@const href = prop(child, "href") ?? ""}
    <a
      {href}
      class="cursor-pointer wrap-anywhere text-accent underline-offset-2 hover:underline"
      onclick={(event) => {
        event.preventDefault();
        if (href) openExternal(href);
      }}
      >{#if child.children.length}{@render children(child, { ...ctx, inText: true })}{:else}{prop(child, "label") ??
          href}{/if}</a
    >
  {:else if child.type === "Input"}
    {@const rows = count(child, "rows") ?? 1}
    {@const label = prop(child, "label")}
    <div class="flex min-w-0 flex-1 basis-full gap-2 {rows > 1 ? 'items-start' : 'items-center'}" {...marks(child)}>
      {#if label}
        <span class="shrink-0 text-on-surface-variant {rows > 1 ? 'pt-1.5' : ''}">{label}</span>
      {/if}
      {#if rows > 1}
        <textarea
          class={FIELD_CLASS}
          style="height: calc({rows} * var(--mod-line, 1lh) + 0.5rem)"
          value={fieldValue(child)}
          placeholder={prop(child, "placeholder") ?? undefined}
          disabled={child.press === null}
          oninput={(event) => type(child, event.currentTarget.value)}
          onkeydown={(event) => fieldKeydown(child, event)}
        ></textarea>
      {:else}
        <input
          class={FIELD_CLASS}
          value={fieldValue(child)}
          placeholder={prop(child, "placeholder") ?? undefined}
          disabled={child.press === null}
          oninput={(event) => type(child, event.currentTarget.value)}
          onkeydown={(event) => fieldKeydown(child, event)}
        />
      {/if}
      <button type="button" class={FIELD_BUTTON_CLASS} disabled={child.press === null} onclick={() => submit(child)}>
        {prop(child, "submitLabel") ?? t("SEND")}
      </button>
    </div>
  {:else if child.type === "Select"}
    {@const label = prop(child, "label")}
    {@const options = optionsOf(child)}
    {@const picked = options.find((option) => option.value === prop(child, "value")) ?? null}
    {@const menuKey = draftKey(child)}
    <div class="flex min-w-0 shrink-0 items-center gap-2" {...marks(child)}>
      {#if label}
        <span class="shrink-0 text-on-surface-variant">{label}</span>
      {/if}
      <PopupMenu
        open={openMenu === menuKey}
        label={label ?? t("MORE_OPTIONS")}
        align="start"
        onOpenChange={(open) => (openMenu = open ? menuKey : null)}
      >
        {#snippet triggerChild(props)}
          <button
            type="button"
            class="{BUTTON_CLASS} {BUTTON_LOOK.secondary}"
            disabled={child.press === null}
            {...props}
          >
            <span class="min-w-0 truncate {picked ? '' : 'text-on-surface-variant'}"
              >{picked?.label ?? t("MOD_SELECT_NONE")}</span
            >
            <ChevronDown size={14} class="shrink-0 text-on-surface-variant" />
          </button>
        {/snippet}
        {#each options as option (option.value)}
          <MenuItem
            text={option.label}
            selected={option.value === picked?.value}
            onclick={() => option.value !== picked?.value && child.press && port.select(child, option.value)}
          />
        {/each}
      </PopupMenu>
    </div>
  {:else if child.type === "Markdown"}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="min-w-0"
      style={child.props.dimColor ? `color: ${DIM}` : undefined}
      {...marks(child)}
      onclickcapture={(event) => linkPress(child, event)}
    >
      <MarkdownText
        text={prop(child, "text") ?? ""}
        dense
        class="min-w-0"
        onSuggest={mods.host?.pickSuggestion ?? null}
      />
    </div>
  {:else if child.type === "Code"}
    <ModCode
      source={prop(child, "source") ?? ""}
      language={prop(child, "language")}
      diff={child.props.format === "diff"}
      startLine={count(child, "startLine") ?? null}
      truncate={child.props.wrap === "truncate-end"}
    />
  {:else if child.type === "Svg"}
    <img
      src={svgSource(prop(child, "source") ?? "")}
      alt={prop(child, "alt") ?? ""}
      width={count(child, "width")}
      height={count(child, "height")}
      draggable="false"
      class="max-w-full shrink-0 self-start"
    />
  {:else if child.type === "Client"}
    <ModClient {mods} {site} node={child} />
  {:else if child.type === "engine"}
    <div class="min-w-0">{@render engine?.()}</div>
  {/if}
{/snippet}

<div class="relative flex min-w-0 flex-col">
  {@render render(node, { ...ROOT, edge: flush })}
</div>
