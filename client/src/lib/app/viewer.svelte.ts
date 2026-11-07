export interface OpenedFile {
  project: string | null;
  path: string | null;
  status: string;
  full: boolean;
}

export type DatabaseObjectKind = "table" | "view" | "console";

export interface DatabaseObjectRef {
  connection: string;
  database: string | null;
  schema: string | null;
  name: string;
  kind: DatabaseObjectKind;
}

export interface OpenedObject extends Omit<DatabaseObjectRef, "connection"> {
  connection: string | null;
  full: boolean;
}

export const opened = $state<OpenedFile>({ project: null, path: null, status: "", full: false });

export const openedObject = $state<OpenedObject>({
  connection: null,
  database: null,
  schema: null,
  name: "",
  kind: "table",
  full: false,
});

export const sameObject = (shown: OpenedObject | DatabaseObjectRef | null, row: DatabaseObjectRef): boolean =>
  !!shown &&
  shown.connection === row.connection &&
  shown.database === row.database &&
  shown.kind === row.kind &&
  (row.kind === "console" || (shown.schema === row.schema && shown.name === row.name));

export const closeProjectFile = () => {
  opened.path = null;
  opened.full = false;
};

export const closeDatabaseObject = () => {
  openedObject.connection = null;
  openedObject.full = false;
};

export const openProjectFile = (project: string, path: string, status: string) => {
  closeDatabaseObject();
  opened.project = project;
  opened.path = path;
  opened.status = status;
  opened.full = false;
};

export const openDatabaseObject = (target: DatabaseObjectRef) => {
  closeProjectFile();
  Object.assign(openedObject, target, { full: false });
};
