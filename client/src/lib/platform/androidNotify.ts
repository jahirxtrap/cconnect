import { settings } from "$lib/data/settings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { nativeNotifications } from "./androidSocket";

export const publishNotificationTitles = () => {
  nativeNotifications(
    settings.notifyTaskDone ? t("NOTIF_TASK_DONE") : "",
    settings.notifyInteraction ? t("NOTIF_PERMISSION") : "",
  );
};
