import type { PackFont } from "./model";
import type { PackSource } from "./reader";
import { sourceOf } from "./storage";

interface Registered {
  pack: string;
  faces: Promise<FontFace[]>;
}

const registered = new Map<string, Registered>();

const register = async (font: PackFont, face: string, given: PackSource | null): Promise<FontFace[]> => {
  const source = given ?? (await sourceOf(font.pack));
  const faces: FontFace[] = [];
  for (const file of font.files) {
    const bytes = source?.bytes(file.file);
    if (!bytes) continue;
    try {
      const loaded = await new FontFace(face, bytes.slice(), { weight: file.weight, style: file.style }).load();
      document.fonts.add(loaded);
      faces.push(loaded);
    } catch {
      continue;
    }
  }
  return faces;
};

export const loadFace = (font: PackFont, source: PackSource | null = null): Promise<unknown> => {
  if (!font.face) return Promise.resolve();
  let entry = registered.get(font.face);
  if (!entry) {
    entry = { pack: font.pack, faces: register(font, font.face, source) };
    registered.set(font.face, entry);
  }
  return entry.faces;
};

export const dropFaces = async (pack: string) => {
  for (const [face, entry] of registered) {
    if (entry.pack !== pack) continue;
    registered.delete(face);
    for (const loaded of await entry.faces) document.fonts.delete(loaded);
  }
};
