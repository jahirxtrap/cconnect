import CircleUser from "@lucide/svelte/icons/circle-user";
import Component from "@lucide/svelte/icons/component";
import type { IconSource } from "./icons";

export const accountIcon = (provider: boolean): IconSource => (provider ? Component : CircleUser);
