import { settings } from "$lib/data/settings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { nativeNotifications } from "./androidSocket";

const NAME_SLOT = "{1}";

export const publishNotificationTitles = () => {
  nativeNotifications(
    settings.notifyTaskDone ? t("NOTIF_TASK_DONE", NAME_SLOT) : "",
    settings.notifyInteraction ? t("NOTIF_PERMISSION", NAME_SLOT) : "",
    t("CLAUDE"),
  );
};
