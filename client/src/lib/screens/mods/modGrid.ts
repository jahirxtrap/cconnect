import { getContext, setContext } from "svelte";

export interface ModGrid {
  columns: number;
  cell: number;
  line: number;
}

const MIN_COLUMNS = 20;
const MOD_GRID = Symbol("mod-grid");
const MOD_SCALE = Symbol("mod-scale");

export const gridOf = (room: number, glyph: number, line: number, reserve = 0): ModGrid => {
  if (!glyph) return { columns: 0, cell: 0, line };
  const fit = Math.floor((room - reserve) / glyph);
  return fit < MIN_COLUMNS ? { columns: MIN_COLUMNS, cell: glyph, line } : { columns: fit, cell: room / fit, line };
};

export const provideGrid = (grid: () => ModGrid) => setContext(MOD_GRID, grid);

export const siteGrid = (): (() => ModGrid) => getContext(MOD_GRID);

export const provideScale = (scale: () => number) => setContext(MOD_SCALE, scale);

export const siteScale = (): (() => number) => getContext<(() => number) | undefined>(MOD_SCALE) ?? (() => 1);
