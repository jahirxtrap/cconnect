export interface ResizeHandleOptions {
  axis: "x" | "y";
  value: () => number;
  min: number;
  max: () => number;
  invert?: boolean;
  onResize: (value: number) => void;
  onDragging?: (active: boolean) => void;
}

export const resizeHandle = (node: HTMLElement, options: ResizeHandleOptions) => {
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    node.setPointerCapture(event.pointerId);
    options.onDragging?.(true);

    const origin = options.axis === "x" ? event.clientX : event.clientY;
    const from = options.value();
    const direction = options.invert ? -1 : 1;

    const move = (drag: PointerEvent) => {
      const now = options.axis === "x" ? drag.clientX : drag.clientY;
      const next = from + (now - origin) * direction;
      options.onResize(Math.min(options.max(), Math.max(options.min, next)));
    };

    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      options.onDragging?.(false);
    };

    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  };

  node.addEventListener("pointerdown", onPointerDown);
  return { destroy: () => node.removeEventListener("pointerdown", onPointerDown) };
};
