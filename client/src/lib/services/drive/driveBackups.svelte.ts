import { backupCounts, exportSettings, importSettings } from "$lib/data/backup";
import { decryptBackup, encryptBackup } from "$lib/data/backupCrypto";
import { platformName } from "$lib/platform";
import { deleteCopy, downloadCopy, listCopies, uploadCopy, type DriveCopy } from "./driveApi";
import { googleSession } from "./googleSession.svelte";

const KEEP = 10;

const DEVICES: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS",
  web: "Web",
};

const DEVICE = DEVICES[platformName()] ?? platformName();

export type RestoreResult = "ok" | "password" | "failed";

export interface UploadOptions {
  notes: boolean;
  password: string;
}

const activeToken = async (interactive: boolean): Promise<string> => {
  const token = await googleSession.token();
  if (token || !interactive) return token;
  return (await googleSession.connect()) ? googleSession.token() : "";
};

const fileName = (): string => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  return `cconnect-${DEVICE.toLowerCase()}-${stamp}.json`;
};

class DriveBackups {
  copies = $state<DriveCopy[]>([]);
  loading = $state(false);
  busy = $state(false);
  failed = $state(false);

  #listing: Promise<void> | null = null;

  clear() {
    this.copies = [];
    this.failed = false;
  }

  async refresh() {
    this.#listing ??= this.#list();
    await this.#listing;
  }

  async #list() {
    this.loading = true;
    const token = await activeToken(false);
    const copies = token ? await listCopies(token) : null;
    if (copies) this.copies = copies;
    this.failed = copies === null;
    this.loading = false;
    this.#listing = null;
  }

  async upload(options: UploadOptions): Promise<boolean> {
    this.busy = true;
    const payload = exportSettings({ notes: options.notes });
    const counts = backupCounts(payload);
    const content = options.password ? await encryptBackup(payload, options.password) : payload;
    const token = await activeToken(true);
    const copy = token
      ? await uploadCopy(token, fileName(), content, {
          device: DEVICE,
          encrypted: options.password !== "",
          environments: counts.environments,
          notes: counts.notes,
        })
      : null;
    if (copy) {
      this.copies = [copy, ...this.copies];
      await this.#prune(token);
    }
    this.failed = copy === null;
    this.busy = false;
    return copy !== null;
  }

  async restore(copy: DriveCopy, password: string): Promise<RestoreResult> {
    this.busy = true;
    const token = await activeToken(true);
    const raw = token ? await downloadCopy(token, copy.id) : null;
    const plain = raw === null ? null : copy.encrypted ? await decryptBackup(raw, password) : raw;
    const result: RestoreResult =
      raw === null ? "failed" : plain === null ? "password" : importSettings(plain) ? "ok" : "failed";
    this.failed = result === "failed";
    this.busy = false;
    return result;
  }

  async remove(copy: DriveCopy): Promise<boolean> {
    this.busy = true;
    const token = await activeToken(true);
    const removed = token ? await deleteCopy(token, copy.id) : false;
    if (removed) this.copies = this.copies.filter((item) => item.id !== copy.id);
    this.failed = !removed;
    this.busy = false;
    return removed;
  }

  async #prune(token: string) {
    for (const old of this.copies.slice(KEEP)) await deleteCopy(token, old.id);
    this.copies = this.copies.slice(0, KEEP);
  }
}

export const driveBackups = new DriveBackups();
