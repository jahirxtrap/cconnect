import { mount } from "svelte";
import { SECURE_KEYS, secureStore } from "$lib/platform/secureStorage";
import "./app.css";

await secureStore.load(SECURE_KEYS);
const { default: App } = await import("./App.svelte");

export default mount(App, { target: document.getElementById("app")! });
