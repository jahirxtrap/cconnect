const ENDS = ["pointerup", "pointercancel"];
const ENDS_ON_BLUR = [...ENDS, "blur"];

export const followPointer = (
  onMove: (event: PointerEvent) => void,
  onEnd: (event: Event) => void,
  endOnBlur: boolean,
): (() => void) => {
  const ends = endOnBlur ? ENDS_ON_BLUR : ENDS;
  window.addEventListener("pointermove", onMove);
  for (const type of ends) window.addEventListener(type, onEnd);
  return () => {
    window.removeEventListener("pointermove", onMove);
    for (const type of ends) window.removeEventListener(type, onEnd);
  };
};
