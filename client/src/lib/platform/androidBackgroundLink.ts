import { settings } from "$lib/data/settings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { backend } from "$lib/services/backend.svelte";
import { notifier } from "$lib/services/notifier.svelte";

const handover = (): string | null => {
  const url = backend.socketUrl("/list/ws");
  const done = settings.notifyTaskDone ? t("NOTIF_TASK_DONE") : "";
  const waiting = settings.notifyInteraction ? t("NOTIF_PERMISSION") : "";
  if (!url || !notifier.granted || (!done && !waiting)) return null;
  return JSON.stringify({ url, done, waiting });
};

export const handOverInBackground = () => {
  (window as unknown as { __cconnectBackground?: () => string | null }).__cconnectBackground = handover;
};
