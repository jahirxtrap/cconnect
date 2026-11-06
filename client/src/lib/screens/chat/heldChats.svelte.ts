import { ChatState, type ChatContext } from "./state.svelte";

export interface HeldChat {
  chat: ChatState;
  stop: () => void;
}

export const holdChat = (
  held: Map<string, HeldChat>,
  id: string,
  context: ChatContext,
  watch: (chat: ChatState) => void,
): ChatState => {
  const existing = held.get(id);
  if (existing) return existing.chat;
  let created!: ChatState;
  const stop = $effect.root(() => {
    created = new ChatState(context);
    watch(created);
  });
  held.set(id, { chat: created, stop });
  return created;
};
