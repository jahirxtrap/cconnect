import { mount } from "svelte";
import { polyfillFieldSizing } from "$lib/platform/fieldSizing";
import { clearFocusOnKeyboardHide } from "$lib/platform/keyboard";
import { SECURE_KEYS, secureStore } from "$lib/platform/secureStorage";
import "./app.css";

const SELECTABLE = "input, textarea, [contenteditable], .selectable";
const NATIVE_MENU = `${SELECTABLE}, [data-native-menu]`;

const matches = (target: EventTarget | null, selector: string) =>
  target instanceof Element && target.closest(selector) !== null;

const allowsSelection = (target: EventTarget | null) => matches(target, SELECTABLE);

document.addEventListener("contextmenu", (event) => {
  if (!matches(event.target, NATIVE_MENU)) event.preventDefault();
});

document.addEventListener("selectionchange", () => {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed) return;
  const node = selection.anchorNode;
  const host = node instanceof Element ? node : node?.parentElement;
  if (!allowsSelection(host ?? null)) selection.removeAllRanges();
});

clearFocusOnKeyboardHide();
polyfillFieldSizing();

await secureStore.load(SECURE_KEYS);
const { default: App } = await import("./App.svelte");

export default mount(App, { target: document.getElementById("app")! });
