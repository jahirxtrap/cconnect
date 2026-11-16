import { settings } from "$lib/data/settings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { tabs } from "$lib/screens/chat/tabs.svelte";
import { nativeNotifications, nativeWatched } from "./androidSocket";

const NAME_SLOT = "{1}";

export const publishNotificationTitles = () => {
  nativeNotifications(
    settings.notifyTaskDone ? t("NOTIF_TASK_DONE", NAME_SLOT) : "",
    settings.notifyInteraction ? t("NOTIF_PERMISSION", NAME_SLOT) : "",
    t("CLAUDE"),
  );
};

export const publishWatchedSessions = () => {
  const locked = settings.lockedProject;
  nativeWatched(
    tabs.list.flatMap((tab) => (tab.sessionId && (!locked || tab.projectKey === locked) ? [tab.sessionId] : [])),
  );
};
