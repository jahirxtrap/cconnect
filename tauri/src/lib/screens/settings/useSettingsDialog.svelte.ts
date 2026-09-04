import { useHighlight } from "$lib/app/useHighlight.svelte";
import type { SettingsSection } from "./sections";
import { entryFor, type SettingsDialog } from "./settingsIndex";

export const useSettingsDialog = (
  section: SettingsSection,
  open: (dialog: SettingsDialog) => void,
) =>
  useHighlight((target) => {
    const entry = entryFor(target);
    if (entry?.section === section && entry.dialog) open(entry.dialog);
  });
