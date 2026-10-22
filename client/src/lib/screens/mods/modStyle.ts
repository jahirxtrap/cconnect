import type { ModChild, ModNode } from "$lib/data/modModels";
import { DIM, modColor } from "./modTheme";

type Props = Record<string, unknown>;

type Axis = "x" | "y";

type Edge = "top" | "right" | "bottom" | "left";

interface Border {
  width: Partial<Record<Edge, string>>;
  style: string;
  radius: string;
}

const STEPS: Record<Axis, Record<string, number>> = {
  x: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  y: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16 },
};

const UNIT: Record<Axis, string> = { x: "var(--mod-cell, 1ch)", y: "var(--mod-line, 1lh)" };

const GAP_UNIT: Record<Axis, string> = { x: UNIT.x, y: "calc(var(--mod-line, 1lh) / 2)" };

const CHIP_GAP = "calc(var(--spacing) * 1.5)";

const EDGES: [Edge, string, Axis][] = [
  ["top", "Top", "y"],
  ["right", "Right", "x"],
  ["bottom", "Bottom", "y"],
  ["left", "Left", "x"],
];

const even = (width: string) => ({ top: width, right: width, bottom: width, left: width });

const BORDERS: Record<string, Border> = {
  single: { width: even("1px"), style: "solid", radius: "var(--radius-xs)" },
  round: { width: even("1px"), style: "solid", radius: "var(--radius-md)" },
  bold: { width: even("2px"), style: "solid", radius: "var(--radius-xs)" },
  double: { width: even("3px"), style: "double", radius: "var(--radius-xs)" },
  singleDouble: { width: { top: "1px", bottom: "1px", left: "3px", right: "3px" }, style: "solid", radius: "var(--radius-xs)" },
  doubleSingle: { width: { top: "3px", bottom: "3px", left: "1px", right: "1px" }, style: "solid", radius: "var(--radius-xs)" },
  classic: { width: even("1px"), style: "solid", radius: "0" },
  arrow: { width: even("1px"), style: "solid", radius: "0" },
  dashed: { width: even("1px"), style: "dashed", radius: "var(--radius-xs)" },
  quote: { width: { left: "3px" }, style: "solid", radius: "0" },
};

const KEYWORDS: [string, string][] = [
  ["alignItems", "align-items"],
  ["alignSelf", "align-self"],
  ["justifyContent", "justify-content"],
  ["overflow", "overflow"],
  ["flexGrow", "flex-grow"],
  ["flexShrink", "flex-shrink"],
];

const LENGTHS: [string, string, Axis][] = [
  ["width", "width", "x"],
  ["minWidth", "min-width", "x"],
  ["height", "height", "y"],
  ["minHeight", "min-height", "y"],
  ["top", "top", "y"],
  ["bottom", "bottom", "y"],
  ["left", "left", "x"],
  ["right", "right", "x"],
];

const SIZES: Record<string, string> = {
  caption: "var(--text-label-sm)",
  footnote: "var(--text-body-sm)",
  body: "var(--text-body-md)",
  heading: "var(--text-title-md)",
  title: "var(--text-title-lg)",
};

const WEIGHTS: Record<string, number> = { regular: 400, medium: 500, semibold: 600, bold: 700 };

const TRUNCATE_END = new Set(["end", "truncate", "truncate-end"]);
const TRUNCATE_START = new Set(["truncate-start"]);
const TRUNCATE_MIDDLE = new Set(["middle", "truncate-middle"]);
const PERCENT = /^\d{1,3}%$/;

export type Wrap = "wrap" | "end" | "start" | "middle";

export type ButtonRow = "chips" | "mixed" | null;

const spaceOf = (value: unknown, axis: Axis): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return `calc(${value} * ${GAP_UNIT[axis]})`;
  if (typeof value === "string" && Object.hasOwn(STEPS[axis], value)) return `${STEPS[axis][value]}px`;
  return null;
};

const BORDER_ROOM: Record<Axis, string> = { x: "calc(var(--mod-cell, 1ch) / 2)", y: "calc(var(--mod-line, 1lh) / 4)" };

const sideOf = (props: Props, kind: "margin" | "padding", edge: string, axis: Axis): string =>
  spaceOf(props[`${kind}${edge}`], axis) ?? spaceOf(props[`${kind}${axis.toUpperCase()}`], axis) ?? spaceOf(props[kind], axis) ?? "0px";

const paddingOf = (props: Props, edge: string, axis: Axis, framed: boolean): string =>
  framed ? `calc(${sideOf(props, "padding", edge, axis)} + ${BORDER_ROOM[axis]})` : sideOf(props, "padding", edge, axis);

const lengthOf = (value: unknown, axis: Axis): string | null =>
  typeof value === "number" && Number.isFinite(value)
    ? `calc(${value} * ${UNIT[axis]})`
    : typeof value === "string" && PERCENT.test(value)
      ? value
      : null;

const keyword = (value: unknown): string | number | null =>
  typeof value === "string" && /^[a-z-]+$/.test(value) ? value : typeof value === "number" && Number.isFinite(value) ? value : null;

const rules = (entries: [string, string | number | null | undefined][]): string =>
  entries
    .filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined && entry[1] !== "")
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");

export const borderOf = (props: Props): Border | null =>
  typeof props.borderStyle === "string" && Object.hasOwn(BORDERS, props.borderStyle) ? BORDERS[props.borderStyle] : null;

const NEUTRAL = new Set(["gray", "grey", "white", "whiteBright", "black", "blackBright", "inactive", "subtle", "text", "promptBorder"]);

const borderColorOf = (props: Props): string => {
  const own = typeof props.borderColor === "string" && !NEUTRAL.has(props.borderColor) ? modColor(props.borderColor) : null;
  if (props.borderDimColor) return own ? `color-mix(in srgb, ${own} 45%, transparent)` : "var(--color-outline-variant)";
  return own ?? "var(--color-outline)";
};

export const unpadded = (props: Props): Props => {
  const { paddingX: _x, paddingLeft: _left, paddingRight: _right, padding, ...rest } = props;
  return padding === undefined ? rest : { ...rest, paddingY: rest.paddingY ?? padding };
};

export const boxStyle = (props: Props, buttonRow: ButtonRow): string => {
  const border = borderOf(props);
  const color = borderColorOf(props);
  const chips = buttonRow === "chips";
  const across = spaceOf(props.columnGap, "x") ?? (chips ? CHIP_GAP : spaceOf(props.gap, "x")) ?? (buttonRow ? `${STEPS.x.xs}px` : null);
  return rules([
    ["display", props.display === "none" ? "none" : "flex"],
    ["flex-direction", keyword(props.flexDirection) ?? "row"],
    ["position", props.position === "absolute" ? "absolute" : "relative"],
    ["z-index", props.position === "absolute" ? 1 : null],
    ["flex-wrap", keyword(props.flexWrap) ?? (buttonRow ? "wrap" : null)],
    ...KEYWORDS.map(([key, css]): [string, string | number | null] => [css, keyword(props[key])]),
    ["column-gap", across],
    ["row-gap", spaceOf(props.rowGap, "y") ?? (buttonRow ? CHIP_GAP : spaceOf(props.gap, "y"))],
    ["margin", EDGES.map(([, edge, axis]) => sideOf(props, "margin", edge, axis)).join(" ")],
    ["padding", EDGES.map(([, edge, axis]) => paddingOf(props, edge, axis, border !== null)).join(" ")],
    ...LENGTHS.map(([key, css, axis]): [string, string | null] => [css, lengthOf(props[key], axis)]),
    ...(border
      ? EDGES.map(([edge]): [string, string] => [
          `border-${edge}`,
          border.width[edge] ? `${border.width[edge]} ${border.style} ${color}` : "none",
        ])
      : []),
    ["border-radius", border?.radius],
    ["background-color", modColor(props.backgroundColor)],
  ]);
};

export const textStyle = (props: Props): string => {
  const own = modColor(props.color);
  const color = props.dimColor ? (own ? `color-mix(in srgb, ${own} 60%, transparent)` : DIM) : own;
  const background = modColor(props.backgroundColor);
  const weight =
    typeof props.weight === "string" && Object.hasOwn(WEIGHTS, props.weight)
      ? WEIGHTS[props.weight]
      : props.bold === true
        ? WEIGHTS.semibold
        : null;
  const decoration = [props.underline && "underline", props.strikethrough && "line-through"].filter(Boolean).join(" ");
  const size = typeof props.size === "string" && Object.hasOwn(SIZES, props.size) ? SIZES[props.size] : null;
  return rules([
    ["color", props.inverse ? (background ?? "var(--color-surface)") : color],
    ["background-color", props.inverse ? (color ?? "var(--color-on-surface)") : background],
    ["font-weight", weight],
    ["font-style", props.italic ? "italic" : null],
    ["font-size", size],
    ["font-family", props.mono ? "var(--font-mono)" : null],
    ["font-variant-numeric", props.tabular ? "tabular-nums" : null],
    ["text-decoration-line", decoration || null],
    ["direction", props.dir === "rtl" ? "rtl" : null],
    ["border-radius", props.inverse || background ? "var(--radius-xs)" : null],
  ]);
};

export const wrapOf = (props: Props): Wrap => {
  const wrap = typeof props.wrap === "string" ? props.wrap : "wrap";
  if (TRUNCATE_END.has(wrap)) return "end";
  if (TRUNCATE_START.has(wrap)) return "start";
  if (TRUNCATE_MIDDLE.has(wrap)) return "middle";
  return "wrap";
};

export const middleCut = (text: string, room: number): string => {
  const glyphs = [...text];
  if (glyphs.length <= room) return text;
  if (room <= 1) return "…".slice(0, Math.max(0, room));
  const head = Math.ceil((room - 1) / 2);
  return `${glyphs.slice(0, head).join("")}…${glyphs.slice(glyphs.length - (room - 1 - head)).join("")}`;
};

const EIGHTH = 12.5;
const HALF = 50;
const ART_GLYPHS = /[─-▟]/u;

export const svgSource = (source: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

const armPath = (arm: string, axis: number): string =>
  ({ l: `M0 ${axis}H1`, r: `M1 ${axis}H2`, u: `M1 0V${axis}`, d: `M1 ${axis}V2` })[arm] ?? "";

const BOX_ARMS: Record<string, string> = {
  "─": "lr",
  "━": "LR",
  "│": "ud",
  "┃": "UD",
  "┌": "rd",
  "┐": "ld",
  "└": "ru",
  "┘": "lu",
  "┏": "RD",
  "┓": "LD",
  "┗": "RU",
  "┛": "LU",
  "├": "udr",
  "┤": "udl",
  "┬": "lrd",
  "┴": "lru",
  "┼": "lrud",
  "┣": "UDR",
  "┫": "UDL",
  "┳": "LRD",
  "┻": "LRU",
  "╋": "LRUD",
  "╴": "l",
  "╵": "u",
  "╶": "r",
  "╷": "d",
  "╸": "L",
  "╹": "U",
  "╺": "R",
  "╻": "D",
};

const BOX_ARCS: Record<string, (axis: number) => string> = {
  "╭": (axis) => `M2 ${axis}Q1 ${axis} 1 2`,
  "╮": (axis) => `M0 ${axis}Q1 ${axis} 1 2`,
  "╯": (axis) => `M0 ${axis}Q1 ${axis} 1 0`,
  "╰": (axis) => `M2 ${axis}Q1 ${axis} 1 0`,
};

const VIEW_HEIGHT = 2;
const AXIS_STEPS = 100;

const strokeMask = (path: string, width: number, rendering: string): string =>
  svgSource(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 ${VIEW_HEIGHT}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#000" stroke-width="${width}" stroke-linecap="square" vector-effect="non-scaling-stroke" shape-rendering="${rendering}"/></svg>`,
  );

const armsMask = (arms: string, axis: number): string =>
  strokeMask(
    [...arms.toLowerCase()].map((arm) => armPath(arm, axis)).join(""),
    arms === arms.toUpperCase() ? 2 : 1,
    "crispEdges",
  );

const strokeSets = new Map<number, Record<string, string>>();

const strokesAt = (fraction: number): Record<string, string> => {
  const axis = Math.round(fraction * VIEW_HEIGHT * AXIS_STEPS) / AXIS_STEPS;
  let set = strokeSets.get(axis);
  if (!set) {
    set = {
      ...Object.fromEntries(Object.entries(BOX_ARMS).map(([glyph, arms]) => [glyph, armsMask(arms, axis)])),
      ...Object.fromEntries(
        Object.entries(BOX_ARCS).map(([glyph, path]) => [glyph, strokeMask(path(axis), 1, "geometricPrecision")]),
      ),
    };
    strokeSets.set(axis, set);
  }
  return set;
};

const STROKED = new Set([...Object.keys(BOX_ARMS), ...Object.keys(BOX_ARCS)]);

const edge = (side: string, percent: number) =>
  `linear-gradient(to ${side}, currentColor ${percent}%, transparent ${percent}%)`;

const shade = (percent: number) => {
  const tone = `color-mix(in srgb, currentColor ${percent}%, transparent)`;
  return `linear-gradient(${tone}, ${tone})`;
};

const BLOCKS: Record<string, string> = {
  "▀": edge("bottom", HALF),
  "▔": edge("bottom", EIGHTH),
  "▐": edge("left", HALF),
  "▕": edge("left", EIGHTH),
  "░": shade(25),
  "▒": shade(50),
  "▓": shade(75),
  ...Object.fromEntries([..."▁▂▃▄▅▆▇█"].map((glyph, index) => [glyph, edge("top", (index + 1) * EIGHTH)])),
  ...Object.fromEntries([..."▏▎▍▌▋▊▉"].map((glyph, index) => [glyph, edge("right", (index + 1) * EIGHTH)])),
};

export interface TextRun {
  text: string;
  fill: string | null;
  stroke: string | null;
  line: boolean;
  cells: number;
}

export const textRuns = (text: string): TextRun[] => {
  if (!ART_GLYPHS.test(text)) return [{ text, fill: null, stroke: null, line: false, cells: 0 }];
  const runs: TextRun[] = [];
  for (const glyph of text) {
    const fill = BLOCKS[glyph] ?? null;
    const stroke = STROKED.has(glyph) ? glyph : null;
    const line = !fill && !stroke && ART_GLYPHS.test(glyph);
    const last = runs.at(-1);
    if (last && last.fill === fill && last.stroke === stroke && last.line === line) {
      last.text += glyph;
      last.cells += 1;
    } else runs.push({ text: glyph, fill, stroke, line, cells: 1 });
  }
  return runs;
};

export const blockStyle = (run: TextRun): string =>
  `width: calc(${run.cells} * var(--mod-cell, 1ch)); background: ${run.fill} 0 0 / var(--mod-cell, 1ch) 100% repeat-x`;

export const strokeStyle = (run: TextRun, axis: number): string =>
  `width: calc(${run.cells} * var(--mod-cell, 1ch)); background-color: currentColor; mask: url("${strokesAt(axis)[run.stroke ?? ""]}") 0 0 / var(--mod-cell, 1ch) 100% repeat-x`;

export const LINE_STYLE = "font-size: calc(var(--mod-mono-scale, 1) * var(--text-body-md))";

const ART_RULES = /[-=_~]{3,}|[-=]{2,}>|<[-=]{2,}/u;
const ART_GAPS = /\S( {2,})(?=\S)/gu;

const artLine = (line: string): boolean => {
  if (ART_GLYPHS.test(line) || ART_RULES.test(line)) return true;
  const gaps = [...line.matchAll(ART_GAPS)].map((match) => match[1].length);
  return gaps.length >= 2 || gaps.some((gap) => gap >= 3);
};

export const plainText = (node: ModNode): string | null =>
  node.children.every((kid) => typeof kid === "string") ? (node.children as string[]).join("") : null;

const unwrappedText = (child: ModNode): string | null => {
  const wrap = child.props.wrap;
  return child.type !== "Text" || wrap === undefined || wrap === "wrap" ? null : plainText(child);
};

const artRow = (box: ModNode): ReadonlySet<ModChild> | null => {
  const texts = box.children.filter((kid): kid is ModNode => typeof kid !== "string" && kid.type === "Text");
  return texts.some((kid) => ART_GLYPHS.test(plainText(kid) ?? "")) ? new Set(texts) : null;
};

export const monoRun = (box: ModNode): ReadonlySet<ModChild> | null => {
  const direction = box.props.flexDirection;
  if (direction !== "column" && direction !== "column-reverse") return artRow(box);
  const marked = new Set<ModChild>();
  let run: ModNode[] = [];
  let art = false;
  const close = () => {
    if (art) run.forEach((node) => marked.add(node));
    run = [];
    art = false;
  };
  for (const kid of box.children) {
    if (typeof kid === "string") {
      if (kid.trim()) close();
      continue;
    }
    const text = unwrappedText(kid);
    if (text === null) close();
    else {
      run.push(kid);
      art ||= artLine(text);
    }
  }
  close();
  return marked.size ? marked : null;
};

export const monoText = (node: ModNode): boolean => {
  const text = plainText(node);
  return text !== null && text.includes("\n") && text.split("\n").some(artLine);
};

