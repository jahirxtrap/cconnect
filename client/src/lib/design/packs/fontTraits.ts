import { unzlibSync } from "fflate";

export interface FontTraits {
  weight: string;
  style: string;
}

type Tables = Map<string, DataView>;

const SFNT_RECORD = 16;
const WOFF_RECORD = 20;
const WOFF_DIRECTORY = 44;
const FIXED = 65536;
const ITALIC_BITS = 0b10_0000_0001;
const DEFAULT_TRAITS: FontTraits = { weight: "400", style: "normal" };

const WEIGHT_WORDS: [RegExp, number][] = [
  [/(extra|ultra)[\s_-]?light/, 200],
  [/(semi|demi)[\s_-]?bold/, 600],
  [/(extra|ultra)[\s_-]?bold/, 800],
  [/thin|hairline/, 100],
  [/light/, 300],
  [/medium/, 500],
  [/bold/, 700],
  [/black|heavy/, 900],
];

const VARIABLE_NAME = /variable|wght|(^|[\s_-])vf($|[\s._-])/;
const ITALIC_NAME = /italic|oblique/;
const VARIABLE_RANGE = "100 900";

const tagAt = (view: DataView, offset: number): string =>
  String.fromCharCode(...[0, 1, 2, 3].map((index) => view.getUint8(offset + index)));

const sfntTables = (data: Uint8Array): Tables => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tables: Tables = new Map();
  for (let index = 0; index < view.getUint16(4); index++) {
    const record = 12 + index * SFNT_RECORD;
    const offset = view.getUint32(record + 8);
    tables.set(tagAt(view, record), new DataView(data.buffer, data.byteOffset + offset, view.getUint32(record + 12)));
  }
  return tables;
};

const woffTables = (data: Uint8Array): Tables => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tables: Tables = new Map();
  for (let index = 0; index < view.getUint16(12); index++) {
    const record = WOFF_DIRECTORY + index * WOFF_RECORD;
    const offset = view.getUint32(record + 4);
    const packed = data.subarray(offset, offset + view.getUint32(record + 8));
    const table = packed.byteLength < view.getUint32(record + 12) ? unzlibSync(packed) : packed;
    tables.set(tagAt(view, record), new DataView(table.buffer, table.byteOffset, table.byteLength));
  }
  return tables;
};

const tablesOf = (data: Uint8Array): Tables | null => {
  if (data.byteLength < 12) return null;
  const signature = tagAt(new DataView(data.buffer, data.byteOffset, data.byteLength), 0);
  if (signature === "wOFF") return woffTables(data);
  if (signature === "OTTO" || signature === "true" || signature === "\u0000\u0001\u0000\u0000") return sfntTables(data);
  return null;
};

const weightRange = (fvar: DataView): string | null => {
  const axes = fvar.getUint16(4);
  const size = fvar.getUint16(10);
  for (let index = 0; index < fvar.getUint16(8); index++) {
    const axis = axes + index * size;
    if (tagAt(fvar, axis) !== "wght") continue;
    return `${Math.round(fvar.getInt32(axis + 4) / FIXED)} ${Math.round(fvar.getInt32(axis + 12) / FIXED)}`;
  }
  return null;
};

const fromTables = (tables: Tables): FontTraits | null => {
  const os2 = tables.get("OS/2");
  if (!os2) return null;
  const fvar = tables.get("fvar");
  return {
    weight: (fvar && weightRange(fvar)) ?? String(os2.getUint16(4)),
    style: os2.getUint16(62) & ITALIC_BITS ? "italic" : "normal",
  };
};

const fromName = (file: string): FontTraits => {
  const name = file.slice(file.lastIndexOf("/") + 1).toLowerCase();
  const weight = VARIABLE_NAME.test(name)
    ? VARIABLE_RANGE
    : String(WEIGHT_WORDS.find(([pattern]) => pattern.test(name))?.[1] ?? DEFAULT_TRAITS.weight);
  return { weight, style: ITALIC_NAME.test(name) ? "italic" : DEFAULT_TRAITS.style };
};

export const traitsOf = (data: Uint8Array, file: string): FontTraits => {
  try {
    const tables = tablesOf(data);
    return (tables && fromTables(tables)) ?? fromName(file);
  } catch {
    return fromName(file);
  }
};
