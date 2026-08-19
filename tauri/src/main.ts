import { mount } from "svelte";
import { SECURE_KEYS, secureStore } from "$lib/platform/secureStorage";
import "./app.css";

const SELECTABLE = "input, textarea, [contenteditable], .selectable";

const allowsSelection = (target: EventTarget | null) =>
  target instanceof Element && target.closest(SELECTABLE) !== null;

document.addEventListener("contextmenu", (event) => {
  if (!allowsSelection(event.target)) event.preventDefault();
});

await secureStore.load(SECURE_KEYS);
const { default: App } = await import("./App.svelte");

export default mount(App, { target: document.getElementById("app")! });
