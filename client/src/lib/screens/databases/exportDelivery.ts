import type { DatabaseFailure } from "$lib/data/databaseModels";
import type { DatabaseOutcome } from "$lib/services/databasesApi";
import { downloadUrl } from "$lib/services/sharedApi";
import { downloadShared } from "$lib/services/sharedFiles";

export const deliverExport = async (found: DatabaseOutcome<string>): Promise<{ failure: DatabaseFailure | null } | null> => {
  if (!found.ok || !found.value) return { failure: found.failure };
  await downloadShared(downloadUrl(found.value), found.value.split("/").at(-1) ?? found.value);
  return null;
};
