import { isTouch } from "./index";

const HIDE_MARGIN = 120;

export const clearFocusOnKeyboardHide = () => {
  if (!isTouch) return;
  let tallest = window.innerHeight;
  let open = false;
  window.addEventListener("resize", () => {
    tallest = Math.max(tallest, window.innerHeight);
    const hidden = tallest - window.innerHeight < HIDE_MARGIN;
    if (open && hidden && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    open = !hidden;
  });
};
