export const SETTINGS_SECTIONS = [
  { id: "general", label: "SETTINGS_GENERAL" },
  { id: "client", label: "SETTINGS_CLIENT" },
  { id: "background", label: "BACKGROUND_GROUP" },
  { id: "connectivity", label: "SETTINGS_CONNECTIVITY" },
  { id: "server", label: "SETTINGS_SERVER" },
  { id: "claude", label: "CLAUDE" },
  { id: "recovery", label: "SETTINGS_RECOVERY" },
  { id: "about", label: "ABOUT" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

export const isSettingsSection = (value: string | null): value is SettingsSection =>
  SETTINGS_SECTIONS.some((section) => section.id === value);
