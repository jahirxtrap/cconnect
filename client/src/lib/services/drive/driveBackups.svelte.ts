import { backupCounts, exportSettings, importSettings } from "$lib/data/backup";
import { decryptBackup, encryptBackup } from "$lib/data/backupCrypto";
import { platformName } from "$lib/platform";
import { deleteCopy, downloadCopy, listCopies, uploadCopy, type DriveAuth, type DriveCopy } from "./driveApi";
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

const auth = (interactive: boolean): DriveAuth => ({
  token: () => googleSession.access(interactive),
  renew: () => googleSession.renew(interactive),
});

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
    const copies = await listCopies(auth(false));
    if (copies) this.copies = copies;
    this.failed = copies === null && googleSession.ready;
    this.loading = false;
    this.#listing = null;
  }

  async upload(options: UploadOptions): Promise<boolean> {
    this.busy = true;
    const payload = exportSettings({ notes: options.notes });
    const counts = backupCounts(payload);
    const content = options.password ? await encryptBackup(payload, options.password) : payload;
    const copy = await uploadCopy(auth(true), fileName(), content, {
      device: DEVICE,
      encrypted: options.password !== "",
      environments: counts.environments,
      notes: counts.notes,
    });
    if (copy) {
      this.copies = [copy, ...this.copies];
      await this.#prune();
    }
    this.failed = copy === null;
    this.busy = false;
    return copy !== null;
  }

  async restore(copy: DriveCopy, password: string): Promise<RestoreResult> {
    this.busy = true;
    const raw = await downloadCopy(auth(true), copy.id);
    const plain = raw === null ? null : copy.encrypted ? await decryptBackup(raw, password) : raw;
    const result: RestoreResult =
      raw === null ? "failed" : plain === null ? "password" : importSettings(plain) ? "ok" : "failed";
    this.failed = result === "failed";
    this.busy = false;
    return result;
  }

  async remove(copy: DriveCopy): Promise<boolean> {
    this.busy = true;
    const removed = await deleteCopy(auth(true), copy.id);
    if (removed) this.copies = this.copies.filter((item) => item.id !== copy.id);
    this.failed = !removed;
    this.busy = false;
    return removed;
  }

  async #prune() {
    for (const old of this.copies.slice(KEEP)) await deleteCopy(auth(false), old.id);
    this.copies = this.copies.slice(0, KEEP);
  }
}

export const driveBackups = new DriveBackups();
