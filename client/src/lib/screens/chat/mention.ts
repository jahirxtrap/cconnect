import { tabs } from "$lib/screens/chat/tabs.svelte";

export const mentionInChat = (...paths: string[]) => {
  const chat = tabs.state;
  const mentions = paths.map((path) => `@${path}`).join(" ");
  chat.draft = chat.draft ? `${chat.draft} ${mentions}` : mentions;
};
