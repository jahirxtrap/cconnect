import { request } from "./config";

const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const ABOUT_URL = "https://www.googleapis.com/drive/v3/about";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const JSON_MIME = "application/json";
const FOLDER_NAME = "CConnect";
const APP_MARK = "cconnect";
const BOUNDARY = "cconnect-backup";
const FILE_FIELDS = "id,name,createdTime,appProperties";
const PAGE_SIZE = 50;

export interface DriveUser {
  name: string;
  email: string;
  photo: string;
}

export interface CopyContents {
  device: string;
  encrypted: boolean;
  environments: number;
  notes: number;
}

export interface DriveCopy extends CopyContents {
  id: string;
  name: string;
  createdAt: number;
}

interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
  appProperties?: Record<string, string>;
}

export interface DriveAuth {
  token: () => Promise<string>;
  renew: () => Promise<string>;
}

type Attempt = (token: string) => [string, RequestInit];

const UNAUTHORIZED = 401;

const authorized = (token: string) => ({ Authorization: `Bearer ${token}` });

const answered = async <T>(response: Response | null): Promise<T | null> =>
  response?.ok ? ((await response.json()) as T) : null;

const sent = <T>(url: string, init: RequestInit): Promise<T | null> =>
  request(url, init)
    .catch(() => null)
    .then((response) => answered<T>(response));

const called = async (auth: DriveAuth, attempt: Attempt): Promise<Response | null> => {
  const token = await auth.token();
  if (!token) return null;
  const answer = await request(...attempt(token)).catch(() => null);
  if (answer?.status !== UNAUTHORIZED) return answer;
  const renewed = await auth.renew();
  if (!renewed || renewed === token) return answer;
  return request(...attempt(renewed)).catch(() => null);
};

const fetched = async <T>(auth: DriveAuth, attempt: Attempt): Promise<T | null> =>
  answered<T>(await called(auth, attempt));

const toCopy = (file: DriveFile): DriveCopy => {
  const marks = file.appProperties ?? {};
  return {
    id: file.id,
    name: file.name,
    createdAt: Date.parse(file.createdTime ?? "") || 0,
    device: marks.device ?? "",
    encrypted: marks.encrypted === "1",
    environments: Number(marks.environments ?? 0),
    notes: Number(marks.notes ?? 0),
  };
};

export const fetchUser = async (token: string): Promise<DriveUser | null> => {
  const data = await sent<{ user?: { displayName?: string; emailAddress?: string; photoLink?: string } }>(
    `${ABOUT_URL}?${new URLSearchParams({ fields: "user(displayName,emailAddress,photoLink)" })}`,
    { headers: authorized(token) },
  );
  if (!data?.user?.emailAddress) return null;
  return {
    name: data.user.displayName ?? "",
    email: data.user.emailAddress,
    photo: data.user.photoLink ?? "",
  };
};

const folderId = async (auth: DriveAuth): Promise<string> => {
  const found = await fetched<{ files?: DriveFile[] }>(auth, (token) => [
    `${FILES_URL}?${new URLSearchParams({
      q: `mimeType='${FOLDER_MIME}' and name='${FOLDER_NAME}' and trashed=false`,
      fields: "files(id)",
      pageSize: "1",
    })}`,
    { headers: authorized(token) },
  ]);
  const known = found?.files?.[0]?.id;
  if (known) return known;
  const created = await fetched<DriveFile>(auth, (token) => [
    FILES_URL,
    {
      method: "POST",
      headers: { ...authorized(token), "Content-Type": JSON_MIME },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    },
  ]);
  return created?.id ?? "";
};

export const listCopies = async (auth: DriveAuth): Promise<DriveCopy[] | null> => {
  const data = await fetched<{ files?: DriveFile[] }>(auth, (token) => [
    `${FILES_URL}?${new URLSearchParams({
      q: `appProperties has { key='app' and value='${APP_MARK}' } and trashed=false`,
      orderBy: "createdTime desc",
      pageSize: String(PAGE_SIZE),
      fields: `files(${FILE_FIELDS})`,
    })}`,
    { headers: authorized(token) },
  ]);
  return data ? (data.files ?? []).map(toCopy) : null;
};

export const uploadCopy = async (
  auth: DriveAuth,
  name: string,
  content: string,
  contents: CopyContents,
): Promise<DriveCopy | null> => {
  const parent = await folderId(auth);
  const metadata = {
    name,
    mimeType: JSON_MIME,
    ...(parent ? { parents: [parent] } : {}),
    appProperties: {
      app: APP_MARK,
      device: contents.device,
      encrypted: contents.encrypted ? "1" : "0",
      environments: String(contents.environments),
      notes: String(contents.notes),
    },
  };
  const body = [
    `--${BOUNDARY}`,
    `Content-Type: ${JSON_MIME}; charset=UTF-8`,
    "",
    JSON.stringify(metadata),
    `--${BOUNDARY}`,
    `Content-Type: ${JSON_MIME}; charset=UTF-8`,
    "",
    content,
    `--${BOUNDARY}--`,
    "",
  ].join("\r\n");
  const file = await fetched<DriveFile>(auth, (token) => [
    `${UPLOAD_URL}?${new URLSearchParams({ uploadType: "multipart", fields: FILE_FIELDS })}`,
    {
      method: "POST",
      headers: { ...authorized(token), "Content-Type": `multipart/related; boundary=${BOUNDARY}` },
      body,
    },
  ]);
  return file ? toCopy(file) : null;
};

export const downloadCopy = async (auth: DriveAuth, id: string): Promise<string | null> => {
  const response = await called(auth, (token) => [
    `${FILES_URL}/${id}?alt=media`,
    { headers: authorized(token) },
  ]);
  return response?.ok ? await response.text() : null;
};

export const deleteCopy = async (auth: DriveAuth, id: string): Promise<boolean> => {
  const response = await called(auth, (token) => [
    `${FILES_URL}/${id}`,
    { method: "DELETE", headers: authorized(token) },
  ]);
  return response?.ok ?? false;
};
