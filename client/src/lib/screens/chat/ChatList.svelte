<script lang="ts">
  import type { SessionInfo } from "$lib/data/models";
  import ChatHistory from "./ChatHistory.svelte";
  import type { ChatListEdits } from "./chatListEdits.svelte";
  import SideList from "./SideList.svelte";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState;
    edits: ChatListEdits;
    drawerMode: boolean;
    onClose: (() => void) | null;
    onAfterSelect: () => void;
    onNewTab: (categoryId: string | null) => void;
    onOpenSession: (session: SessionInfo) => void;
    onOpenRight: ((session: SessionInfo) => void) | null;
  }

  const { chat, edits, drawerMode, onClose, onAfterSelect, onNewTab, onOpenSession, onOpenRight }: Props = $props();
</script>

<SideList
  environmentId={chat.environmentId}
  onEnvironment={(id) => chat.selectEnvironment(id)}
  onNewChat={() => {
    chat.newSession();
    onAfterSelect();
  }}
  {drawerMode}
  {onClose}
>
  <ChatHistory {chat} {edits} {onAfterSelect} {onNewTab} {onOpenSession} {onOpenRight} />
</SideList>
