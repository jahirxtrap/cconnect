import type { SessionInfo } from "$lib/data/models";
import { t } from "$lib/i18n/index.svelte";
import { undoNotice } from "$lib/ui/undoNotice.svelte";
import type { ChatState } from "./state.svelte";

export class ChatListEdits {
  renaming = $state<SessionInfo | null>(null);
  coloring = $state<SessionInfo | null>(null);
  deleting = $state<SessionInfo | null>(null);
  moving = $state<{ session: SessionInfo; preset: string | null } | null>(null);
  categorizing = $state<SessionInfo | null>(null);
  forking = $state<{ session: SessionInfo; open: (forked: SessionInfo) => void } | null>(null);
  organizing = $state(false);

  #chat: () => ChatState;

  constructor(chat: () => ChatState) {
    this.#chat = chat;
  }

  get chat(): ChatState {
    return this.#chat();
  }

  remove(session: SessionInfo) {
    const chat = this.chat;
    if (!chat.trashEnabled) {
      this.deleting = session;
      return;
    }
    void chat.remove(session);
    undoNotice.offer(t("CHAT_TRASHED"), () => chat.restoreTrashed(session.sessionId));
  }
}
