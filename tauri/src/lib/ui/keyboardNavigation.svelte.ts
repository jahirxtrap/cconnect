let active = false;

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => {
    if (event.key === "Tab") active = true;
  });
  window.addEventListener("pointerdown", () => {
    active = false;
  });
}

export const keyboardNavigation = {
  get value() {
    return active;
  },
};
