const PINCH_DELTA = 100;
const WHEEL_DELTA = 666;

export const wheelZoomFactor = (event: WheelEvent) => Math.exp(-event.deltaY / (event.ctrlKey ? PINCH_DELTA : WHEEL_DELTA));
