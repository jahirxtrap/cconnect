import { getContext, setContext } from "svelte";

export interface RuleAxes {
  plain: number;
  mono: number;
}

export interface ModGrid {
  columns: number;
  cell: number;
  line: number;
  glyph: number;
  axes: RuleAxes;
}

const MIN_COLUMNS = 20;
const MOD_GRID = Symbol("mod-grid");
const MOD_SCALE = Symbol("mod-scale");
const RULE = "─";
const CENTERED: RuleAxes = { plain: 0.5, mono: 0.5 };

let ruler: CanvasRenderingContext2D | null = null;

const axisOf = (style: CSSStyleDeclaration, line: number): number => {
  ruler ??= document.createElement("canvas").getContext("2d");
  if (!ruler) return CENTERED.plain;
  ruler.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const box = ruler.measureText(RULE);
  const baseline = (line - box.fontBoundingBoxAscent - box.fontBoundingBoxDescent) / 2 + box.fontBoundingBoxAscent;
  return (baseline - (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2) / line;
};

export const ruleAxes = (plain: HTMLElement | null, mono: HTMLElement | null, line: number): RuleAxes =>
  plain && mono && line
    ? { plain: axisOf(getComputedStyle(plain), line), mono: axisOf(getComputedStyle(mono), line) }
    : CENTERED;

export const gridOf = (room: number, glyph: number, line: number, reserve = 0, axes = CENTERED): ModGrid => {
  if (!glyph) return { columns: 0, cell: 0, line, glyph, axes };
  const fit = Math.floor((room - reserve) / glyph);
  return fit < MIN_COLUMNS
    ? { columns: MIN_COLUMNS, cell: glyph, line, glyph, axes }
    : { columns: fit, cell: room / fit, line, glyph, axes };
};

export const gridStyle = (grid: ModGrid): string | undefined =>
  grid.cell
    ? `--mod-cell: ${grid.cell}px; --mod-line: ${grid.line}px; --mod-mono-scale: ${grid.cell / grid.glyph}`
    : undefined;

export const provideGrid = (grid: () => ModGrid) => setContext(MOD_GRID, grid);

export const siteGrid = (): (() => ModGrid) => getContext(MOD_GRID);

export const provideScale = (scale: () => number) => setContext(MOD_SCALE, scale);

export const siteScale = (): (() => number) => getContext<(() => number) | undefined>(MOD_SCALE) ?? (() => 1);
