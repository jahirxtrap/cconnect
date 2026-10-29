<script lang="ts">
  import ChatHistory from "./ChatHistory.svelte";
  import ChatListDialogs from "./ChatListDialogs.svelte";
  import { ChatListEdits } from "./chatListEdits.svelte";
  import ChatsWindow from "./ChatsWindow.svelte";
  import { panes } from "./panes.svelte";
  import type { ChatState } from "./state.svelte";
  import type { PaneRole } from "./tabs.svelte";

  interface Props {
    chat: ChatState;
    focused: boolean;
    role: PaneRole;
  }

  const { chat, focused, role }: Props = $props();

  const edits = new ChatListEdits(() => chat);

  const close = () => (panes.history[role] = false);
</script>

<ChatsWindow {role} {focused} onNewChat={() => chat.newSession()}>
  <ChatHistory
    {chat}
    {edits}
    onAfterSelect={close}
    onNewTab={(categoryId) => panes.newTab(categoryId, role)}
    onOpenSession={(session) => panes.openSession(session, role)}
    onOpenRight={panes.canOpenRight(role) ? (session) => panes.openInRight(session) : null}
  />
</ChatsWindow>

<ChatListDialogs {edits} onOpenChat={close} />
