export type PaneDrag = (pointerX: number, done: boolean) => void;

export const startPaneDrag = (event: PointerEvent, onPaneDrag?: PaneDrag) => {
  if (event.button !== 0 || !onPaneDrag) return;
  if ((event.target as HTMLElement | null)?.closest('[role="tab"], button')) return;
  event.preventDefault();
  const startX = event.clientX;

  const onMovePointer = (move: PointerEvent) => {
    if (move.pointerId !== event.pointerId) return;
    onPaneDrag(move.clientX, false);
  };

  const onUp = (up: Event) => {
    if (up instanceof PointerEvent && up.pointerId !== event.pointerId) return;
    window.removeEventListener("pointermove", onMovePointer);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    onPaneDrag(up instanceof PointerEvent ? up.clientX : startX, true);
  };

  window.addEventListener("pointermove", onMovePointer);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
};
