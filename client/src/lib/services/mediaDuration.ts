import { fetchFile } from "./mediaSource";

const PARTIAL = 206;
const HEAD_BYTES = 8 * 1024;
const BOX_BYTES = 16;
const MOVIE_BYTES = 4 * 1024;
const TOP_BOXES = 32;
const MATROSKA = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const CLUSTER = 0x1f43b675;
const TIMECODE_SCALE = 0x2ad7b1;
const DURATION = 0x4489;
const NANOS_PER_SECOND = 1e9;
const DEFAULT_SCALE = 1_000_000;

interface Chunk {
  view: DataView;
  start: number;
}

interface Element {
  id: number;
  body: number;
  size: number;
}

const fetchRange = async (url: string, start: number, length: number): Promise<Chunk | null> => {
  const response = await fetchFile(url, {}, { Range: `bytes=${start}-${start + length - 1}` });
  if (response.status !== PARTIAL) {
    void response.body?.cancel();
    return null;
  }
  return { view: new DataView(await response.arrayBuffer()), start };
};

const fourCC = (view: DataView, at: number) =>
  String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

const box = (view: DataView, at: number) => {
  const short = view.getUint32(at);
  const type = fourCC(view, at + 4);
  if (short === 1) return { type, header: 16, size: Number(view.getBigUint64(at + 8)) };
  return { type, header: 8, size: short === 0 ? Infinity : short };
};

const movieHeader = (view: DataView, from: number, to: number): number | null => {
  for (let at = from; at + 8 <= to; ) {
    const child = box(view, at);
    if (child.type === "mvhd") {
      const body = at + child.header;
      const wide = view.getUint8(body) === 1;
      const scaleAt = body + (wide ? 20 : 12);
      const timescale = view.getUint32(scaleAt);
      const length = wide ? Number(view.getBigUint64(scaleAt + 4)) : view.getUint32(scaleAt + 4);
      return timescale ? length / timescale : null;
    }
    if (child.size < child.header) return null;
    at += child.size;
  }
  return null;
};

const isoDuration = async (url: string, head: Chunk): Promise<number | null> => {
  let chunk = head;
  let offset = 0;
  for (let hop = 0; hop < TOP_BOXES; hop++) {
    if (offset + BOX_BYTES > chunk.start + chunk.view.byteLength) {
      const next = await fetchRange(url, offset, BOX_BYTES);
      if (!next || next.view.byteLength < 8) return null;
      chunk = next;
    }
    const top = box(chunk.view, offset - chunk.start);
    if (top.type === "moov") {
      if (offset + MOVIE_BYTES > chunk.start + chunk.view.byteLength) {
        const movie = await fetchRange(url, offset, MOVIE_BYTES);
        if (!movie) return null;
        chunk = movie;
      }
      const at = offset - chunk.start;
      return movieHeader(chunk.view, at + top.header, Math.min(chunk.view.byteLength, at + top.size));
    }
    if (!Number.isFinite(top.size) || top.size < top.header) return null;
    offset += top.size;
  }
  return null;
};

const variable = (view: DataView, at: number, marker: boolean) => {
  const first = view.getUint8(at);
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
  if (length > 8) return null;
  let value = marker ? first : first & (0xff >> length);
  let unknown = value === 0xff >> length;
  for (let index = 1; index < length; index++) {
    const byte = view.getUint8(at + index);
    value = value * 256 + byte;
    unknown &&= byte === 0xff;
  }
  return { value, length, unknown: !marker && unknown };
};

const element = (view: DataView, at: number): Element | null => {
  const id = variable(view, at, true);
  const size = id && variable(view, at + id.length, false);
  if (!id || !size) return null;
  return { id: id.value, body: at + id.length + size.length, size: size.unknown ? Infinity : size.value };
};

const unsigned = (view: DataView, at: number, size: number) => {
  let value = 0;
  for (let index = 0; index < size; index++) value = value * 256 + view.getUint8(at + index);
  return value;
};

const infoDuration = (view: DataView, from: number, to: number): number | null => {
  let scale = DEFAULT_SCALE;
  let length: number | null = null;
  for (let at = from; at < to; ) {
    const child = element(view, at);
    if (!child || !Number.isFinite(child.size)) return null;
    if (child.id === TIMECODE_SCALE) scale = unsigned(view, child.body, child.size);
    if (child.id === DURATION) length = child.size === 4 ? view.getFloat32(child.body) : view.getFloat64(child.body);
    at = child.body + child.size;
  }
  return length === null ? null : (length * scale) / NANOS_PER_SECOND;
};

const matroskaDuration = (view: DataView): number | null => {
  const header = element(view, 0);
  const segment = header && element(view, header.body + header.size);
  if (!segment || segment.id !== SEGMENT) return null;
  for (let at = segment.body; at < view.byteLength; ) {
    const child = element(view, at);
    if (!child || child.id === CLUSTER) return null;
    if (child.id === INFO) return infoDuration(view, child.body, Math.min(view.byteLength, child.body + child.size));
    if (!Number.isFinite(child.size)) return null;
    at = child.body + child.size;
  }
  return null;
};

export const mediaDuration = async (url: string): Promise<number | null> => {
  try {
    const head = await fetchRange(url, 0, HEAD_BYTES);
    if (!head || head.view.byteLength < 8) return null;
    const seconds = head.view.getUint32(0) === MATROSKA ? matroskaDuration(head.view) : await isoDuration(url, head);
    return seconds !== null && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
};
