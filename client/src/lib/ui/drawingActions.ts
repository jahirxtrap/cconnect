import { transfers } from "$lib/data/transfers.svelte";
import { drawingImage, type DrawingSource } from "$lib/markdown/drawing";
import { FILE_ACTIONS, type FileActionEntry } from "./sharedFileActions";

const IMAGE_EXTENSION = ".png";
const UNSAFE_NAME = /[\\/:*?"<>|]+/g;

const drawingFilename = (name: string) => `${name.replace(UNSAFE_NAME, " ").trim()}${IMAGE_EXTENSION}`;

export const drawingActions = (
  drawn: () => SVGSVGElement | null,
  name: string,
  source: DrawingSource,
): FileActionEntry[] => {
  const filename = drawingFilename(name);
  const withImage = (run: (blob: Blob) => unknown) => async () => {
    const svg = drawn();
    if (svg) await run(await drawingImage(svg));
  };
  return [
    ...FILE_ACTIONS.map((action) => ({ id: action.id, run: withImage((blob) => action.run({ blob }, filename)) })),
    {
      id: "saveToShared",
      run: withImage((blob) =>
        transfers.upload(new File([blob], filename, { type: blob.type }), source.folder, "keep", source.server),
      ),
    },
  ];
};
