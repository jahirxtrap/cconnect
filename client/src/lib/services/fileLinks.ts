import { projectFileOf, projectFileUrl } from "./projectFilesApi";
import { sharedFolderUrl } from "./sharedApi";

const ABSOLUTE = /^([a-z][a-z\d+.-]*:|\/\/|#)/i;
const ROOT = "file:///";

const decoded = (path: string): string | null => {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
};

export const besideFile = (fileUrl: string, href: string): string | null => {
  if (!href || ABSOLUTE.test(href)) return null;
  const project = projectFileOf(fileUrl);
  if (project) {
    const folder = project.path.slice(0, project.path.lastIndexOf("/") + 1).split("/").map(encodeURIComponent).join("/");
    const path = decoded(new URL(href, `${ROOT}${folder}`).pathname.slice(1));
    return path === null ? null : projectFileUrl(project.project, path);
  }
  const folder = sharedFolderUrl(fileUrl);
  return folder ? new URL(href, folder).href : null;
};
