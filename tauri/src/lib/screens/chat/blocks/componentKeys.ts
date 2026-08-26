import { t } from "$lib/i18n/index.svelte";

export const keyed = (key: string | null, many = false): string | null => {
  switch (key) {
    case "questions":
      return t("QUESTIONS_TITLE");
    case "submit":
      return many ? t("SUBMIT_ANSWERS") : t("SEND");
    case "chat":
      return t("CHAT_ABOUT_THIS");
    case "other":
      return t("INTERACTION_OTHER_HINT");
    case "notes":
      return t("INTERACTION_NOTES_HINT");
    case "add_notes":
      return t("ADD_NOTES");
    case "unused":
      return t("USAGE_UNUSED");
    default:
      return null;
  }
};
