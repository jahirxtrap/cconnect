import type { SessionInfo } from "$lib/data/models";
import type { ChatState } from "./state.svelte";

export class ChatListEdits {
  renaming = $state<SessionInfo | null>(null);
  coloring = $state<SessionInfo | null>(null);
  deleting = $state<SessionInfo | null>(null);
  moving = $state<{ session: SessionInfo; preset: string | null } | null>(null);
  categorizing = $state<SessionInfo | null>(null);
  organizing = $state(false);

  #chat: () => ChatState;

  constructor(chat: () => ChatState) {
    this.#chat = chat;
  }

  get chat(): ChatState {
    return this.#chat();
  }
}
