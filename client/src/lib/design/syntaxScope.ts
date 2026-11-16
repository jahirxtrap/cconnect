import { getContext, setContext } from "svelte";
import { theme } from "./theme.svelte";

const SYNTAX = Symbol("syntax");

export const provideSyntax = (read: () => string) => setContext(SYNTAX, read);

export const contextSyntax = (): (() => string) => getContext<(() => string) | undefined>(SYNTAX) ?? (() => theme.syntax);
