import Bash from "~icons/devicon/bash";
import Fish from "~icons/devicon/fish";
import Powershell from "~icons/devicon/powershell";
import Zsh from "~icons/devicon/zsh";
import type { Component } from "svelte";

const SHELLS: Record<string, Component> = {
  pwsh: Powershell,
  powershell: Powershell,
  bash: Bash,
  zsh: Zsh,
  fish: Fish,
};

export const programName = (path: string | null | undefined): string =>
  (path ?? "").trim().split(/[\\/]/).pop()?.replace(/\.exe$/i, "").toLowerCase() ?? "";

export const shellIcon = (shell: string | null | undefined): Component | null => SHELLS[programName(shell)] ?? null;
