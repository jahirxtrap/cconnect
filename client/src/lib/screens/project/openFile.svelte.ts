export interface OpenedFile {
  project: string | null;
  path: string | null;
  status: string;
  full: boolean;
}

export const opened = $state<OpenedFile>({ project: null, path: null, status: "", full: false });

export const openProjectFile = (project: string, path: string, status: string) => {
  opened.project = project;
  opened.path = path;
  opened.status = status;
  opened.full = false;
};

export const closeProjectFile = () => {
  opened.path = null;
  opened.full = false;
};
