import { getContext, setContext } from "svelte";
import { backend, type Profile } from "./backend.svelte";

const SERVER = Symbol("server");
const SHARED_FOLDER = Symbol("shared-folder");

export const provideServer = (read: () => Profile) => setContext(SERVER, read);

export const contextServer = (): (() => Profile) =>
  getContext<(() => Profile) | undefined>(SERVER) ?? (() => backend.active);

export const provideSharedFolder = (read: () => string) => setContext(SHARED_FOLDER, read);

export const contextSharedFolder = (): (() => string) =>
  getContext<(() => string) | undefined>(SHARED_FOLDER) ?? (() => "");
