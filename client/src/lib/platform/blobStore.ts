const DATABASE = "cconnect.blobs";
const TABLE = "blobs";
const VERSION = 1;

let database: Promise<IDBDatabase> | null = null;

const opened = () => {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(TABLE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
};

const run = async <T>(mode: IDBTransactionMode, action: (table: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const table = (await opened()).transaction(TABLE, mode).objectStore(TABLE);
  return new Promise<T>((resolve, reject) => {
    const request = action(table);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const blobStore = {
  get: (key: string): Promise<Blob | undefined> => run("readonly", (table) => table.get(key)),
  put: (key: string, blob: Blob): Promise<IDBValidKey> => run("readwrite", (table) => table.put(blob, key)),
  remove: (key: string): Promise<undefined> => run("readwrite", (table) => table.delete(key)),
};
