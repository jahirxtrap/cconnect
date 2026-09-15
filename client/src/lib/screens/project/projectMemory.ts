import type { GitRepo } from "$lib/services/gitApi";
import type { ProjectEntry } from "$lib/services/projectFilesApi";

export interface ProjectPosition {
  children: Record<string, ProjectEntry[]>;
  expanded: Record<string, boolean>;
  path: string | null;
  changed: ProjectEntry[] | null;
  repos: GitRepo[] | null;
}

const positions = new Map<string, ProjectPosition>();

export const recallProject = (slot: string): ProjectPosition | undefined => positions.get(slot);

export const rememberProject = (slot: string, position: ProjectPosition) => {
  positions.set(slot, position);
};
