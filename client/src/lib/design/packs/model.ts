import type { BackgroundEffects } from "../backgrounds";
import type { FontKind, ThemeKind } from "./schema";

export interface PackInfo {
  id: string;
  name: string;
  version: string;
  author: string | null;
  contributors: string[];
  description: string | null;
  preview: string | null;
  use: string[];
}

export interface ThemeFile {
  id: string;
  pack: string;
  name: string;
  kind: ThemeKind;
  extends: string | null;
  accent: string | null;
  syntax: string | null;
  colors: Record<string, string>;
}

export interface PackTheme {
  id: string;
  pack: string;
  name: string;
  kind: ThemeKind;
  accent: string;
  syntax: string;
  colors: Record<string, string>;
}

export interface PackTerminal {
  id: string;
  pack: string;
  name: string;
  colors: Record<string, string>;
}

export interface PackAccent {
  id: string;
  pack: string;
  name: string;
  color: string;
}

export interface PackSyntax {
  id: string;
  pack: string;
  name: string;
  file: string | null;
}

export interface FontFile {
  file: string;
  weight: string;
  style: string;
}

export interface PackFont {
  id: string;
  pack: string;
  kind: FontKind;
  name: string | null;
  family: string;
  face: string | null;
  files: FontFile[];
}

export interface PackBackground {
  id: string;
  pack: string;
  name: string | null;
  file: string | null;
  effects: Partial<BackgroundEffects>;
}

export interface Pack {
  info: PackInfo;
  builtin: boolean;
  themes: ThemeFile[];
  terminals: PackTerminal[];
  accents: PackAccent[];
  syntax: PackSyntax[];
  fonts: PackFont[];
  backgrounds: PackBackground[];
}
