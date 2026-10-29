<script lang="ts">
  import { sessionColorOptions } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import ColorDialog from "$lib/ui/ColorDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import type { ChatListEdits } from "./chatListEdits.svelte";
  import MoveSessionDialog from "./MoveSessionDialog.svelte";
  import OrganizeDialog from "./OrganizeDialog.svelte";

  interface Props {
    edits: ChatListEdits;
    onOpenChat: () => void;
  }

  const { edits, onOpenChat }: Props = $props();

  const chat = $derived(edits.chat);
</script>

{#if edits.renaming}
  {@const target = edits.renaming}
  <RenameDialog
    initial={target.title ?? target.preview ?? ""}
    onConfirm={(title) => {
      void chat.rename(target, title);
      edits.renaming = null;
    }}
    onDismiss={() => (edits.renaming = null)}
  />
{/if}

{#if edits.categorizing}
  {@const target = edits.categorizing}
  <RenameDialog
    initial=""
    title={t("ADD_CATEGORY")}
    confirmLabel={t("CREATE")}
    onConfirm={(name) => {
      void chat.createCategoryWith(name, target.sessionId);
      edits.categorizing = null;
    }}
    onDismiss={() => (edits.categorizing = null)}
  />
{/if}

{#if edits.organizing}
  <OrganizeDialog {chat} onDismiss={() => (edits.organizing = false)} {onOpenChat} />
{/if}

{#if edits.moving}
  {@const target = edits.moving}
  <MoveSessionDialog
    session={target.session}
    projects={chat.historyProjects}
    preset={target.preset}
    onConfirm={(cwd) => {
      void chat.move(target.session, cwd);
      edits.moving = null;
    }}
    onDismiss={() => (edits.moving = null)}
  />
{/if}

{#if edits.coloring}
  {@const target = edits.coloring}
  <ColorDialog
    title={t("CONVERSATION_COLOR")}
    options={sessionColorOptions(chat.capabilities?.colors ?? [])}
    selected={target.color}
    onSelect={(color) => void chat.setColor(target, color)}
    onDismiss={() => (edits.coloring = null)}
  />
{/if}

{#if edits.deleting}
  {@const target = edits.deleting}
  <ConfirmDialog
    title={t(chat.trashEnabled ? "TRASH" : "DELETE")}
    text={t(
      chat.trashEnabled ? "TRASH_CONVERSATION_CONFIRM" : "DELETE_CONVERSATION_CONFIRM",
      target.title ?? target.preview ?? target.sessionId,
    )}
    confirmLabel={t(chat.trashEnabled ? "CONFIRM" : "DELETE")}
    danger={!chat.trashEnabled}
    onConfirm={() => {
      void chat.remove(target);
      edits.deleting = null;
    }}
    onDismiss={() => (edits.deleting = null)}
  />
{/if}
