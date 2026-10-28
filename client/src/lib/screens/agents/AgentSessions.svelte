<script lang="ts">
  import History from "@lucide/svelte/icons/history";
  import Trash from "@lucide/svelte/icons/trash";
  import { agentFailureText, type AgentSession } from "$lib/data/agentModels";
  import { sessionIdPreview } from "$lib/data/models";
  import { formatRecent } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { createAgentsApi, type AgentSessionPage } from "$lib/services/agentsApi";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { ChatState } from "$lib/screens/chat/state.svelte";
  import { agentPane } from "./agentPane.svelte";

  interface Props {
    chat: ChatState;
  }

  const { chat }: Props = $props();

  let open = $state(false);
  let page = $state<AgentSessionPage | null>(null);
  let failed = $state<string | null>(null);
  let deleting = $state<string | null>(null);

  const api = $derived(createAgentsApi(() => chat.environment));
  const support = $derived(chat.agentState?.sessions ?? null);
  const removable = $derived(!!support && (support.delete || !support.list));
  const opened = $derived(chat.messages.some((item) => item.role === "user"));
  const label = $derived(
    chat.agentTitle || page?.sessions.find((item) => item.sessionId === chat.sessionId)?.title || t("NEW_CHAT"),
  );

  const load = async (cursor: string | null = null) => {
    if (!chat.agent) return;
    const result = await api.sessions(chat.agent, chat.cwd, cursor);
    if (!result.ok) {
      failed = result.failure ? agentFailureText(result.failure) : t("CONNECTION_ERROR");
      return;
    }
    failed = null;
    page = cursor && page ? { sessions: [...page.sessions, ...result.value.sessions], next: result.value.next } : result.value;
  };

  const pick = (session: AgentSession) => {
    open = false;
    chat.openAgentSession(session.sessionId);
  };

  const remove = async (sessionId: string) => {
    deleting = null;
    if (!chat.agent) return;
    const result = await api.forget(chat.agent, chat.cwd, sessionId);
    if (!result.ok) {
      failed = result.failure ? agentFailureText(result.failure) : t("CONNECTION_ERROR");
      return;
    }
    if (sessionId === chat.sessionId) agentPane.restart(chat);
    page = page ? { ...page, sessions: page.sessions.filter((item) => item.sessionId !== sessionId) } : page;
  };
</script>

<PopupMenu
  {open}
  label={t("CHATS")}
  align="end"
  onOpenChange={(value) => {
    open = value;
    if (value) void load();
  }}
>
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("CHATS")} {...props}>
      <History />
    </TooltipIconButton>
  {/snippet}
  {#if failed}
    <ErrorText text={failed} class="px-2.5 py-1.5" />
  {:else if !page}
    <MenuItem text={t("LOADING")} enabled={false} />
  {:else}
    {#each page.sessions as session (session.sessionId)}
      <MenuItem
        text={session.title ?? sessionIdPreview(session.sessionId)}
        description={session.updatedAt === null ? "" : formatRecent(session.updatedAt)}
        selected={session.sessionId === chat.sessionId}
        onclick={() => pick(session)}
      />
    {:else}
      <MenuItem text={t("NO_CHATS")} enabled={false} />
    {/each}
    {#if page.next}
      {@const cursor = page.next}
      <MenuItem text={t("LOAD_MORE")} closeOnSelect={false} onclick={() => void load(cursor)} />
    {/if}
  {/if}
  {#if removable && opened && chat.sessionId}
    {@const current = chat.sessionId}
    <MenuItem text={t("AGENT_CHAT_DELETE")} icon={Trash} danger onclick={() => (deleting = current)} />
  {/if}
</PopupMenu>

{#if deleting}
  {@const target = deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_CONVERSATION_CONFIRM", label)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => void remove(target)}
    onDismiss={() => (deleting = null)}
  />
{/if}
