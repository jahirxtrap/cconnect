import { getContext, setContext } from "svelte";
import { backend, type Profile } from "./backend.svelte";

const SERVER = Symbol("server");

export const provideServer = (read: () => Profile) => setContext(SERVER, read);

export const contextServer = (): (() => Profile) =>
  getContext<(() => Profile) | undefined>(SERVER) ?? (() => backend.active);
