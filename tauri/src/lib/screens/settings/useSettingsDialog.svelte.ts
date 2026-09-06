import { useHighlight } from "$lib/app/useHighlight.svelte";
import type { SettingsSection } from "./sections";
import { entryFor, type SettingsDialog, type SettingsEntry } from "./settingsIndex";

export const useSettingsDialog = (
  section: SettingsSection,
  open: (dialog: SettingsDialog, entry: SettingsEntry) => void,
) =>
  useHighlight((target) => {
    const entry = entryFor(target);
    if (entry?.section === section && entry.dialog) open(entry.dialog, entry);
  });
