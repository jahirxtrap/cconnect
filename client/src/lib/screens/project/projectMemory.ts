import { Recent } from "$lib/data/recent";
import type { GitRepo } from "$lib/services/gitApi";
import type { ProjectEntry } from "$lib/services/projectFilesApi";

const REMEMBERED = 20;

export interface ProjectPosition {
  children: Record<string, ProjectEntry[]>;
  expanded: Record<string, boolean>;
  path: string | null;
  changed: ProjectEntry[] | null;
  repos: GitRepo[] | null;
  repoRoot: string | null;
  tracked: boolean;
  locked: boolean;
}

const positions = new Recent<string, ProjectPosition>(REMEMBERED);

export const recallProject = (slot: string): ProjectPosition | undefined => positions.get(slot);

export const rememberProject = (slot: string, position: ProjectPosition) => {
  positions.set(slot, position);
};
