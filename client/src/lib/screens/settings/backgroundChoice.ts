import { chatBackground } from "$lib/data/chatBackground.svelte";
import { NO_BACKGROUND } from "$lib/design/backgrounds";
import { TILE_FRAME_CLASS } from "$lib/ui/tile";

export const BACKGROUND_TILE_CLASS = `${TILE_FRAME_CLASS} aspect-[3/4] w-full`;

export const pickBackground = (id: string, onAdjust: () => void) => {
  if (id === chatBackground.current && id !== NO_BACKGROUND) onAdjust();
  else chatBackground.apply(id, {});
};

export const uploadBackground = async (event: Event, onAdjust: () => void) => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  chatBackground.apply(await chatBackground.upload(file), {});
  onAdjust();
};
