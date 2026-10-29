<script lang="ts">
  import type { Snippet } from "svelte";
  import { closeFilePreview, expandFilePreview } from "$lib/app/filePreview";
  import { navigation } from "$lib/app/navigation.svelte";
  import { claudeRefresh } from "$lib/data/claudeRefresh.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import ClaudeActions from "$lib/screens/claude/ClaudeActions.svelte";
  import ClaudeDetail from "$lib/screens/claude/ClaudeDetail.svelte";
  import ClaudeSections from "$lib/screens/claude/ClaudeSections.svelte";
  import BrowserView from "$lib/screens/browser/BrowserView.svelte";
  import AgentsView from "$lib/screens/agents/AgentsView.svelte";
  import ModsView from "$lib/screens/mods/ModsView.svelte";
  import MonitorActions from "$lib/screens/monitor/MonitorActions.svelte";
  import MonitorContent from "$lib/screens/monitor/MonitorContent.svelte";
  import NotesActions from "$lib/screens/notes/NotesActions.svelte";
  import NotesEditor from "$lib/screens/notes/NotesEditor.svelte";
  import NotesList from "$lib/screens/notes/NotesList.svelte";
  import { notes, noteTitle } from "$lib/screens/notes/notes.svelte";
  import ProjectFilesScreen from "$lib/screens/project/ProjectFilesScreen.svelte";
  import FilePreview from "$lib/screens/shared/FilePreview.svelte";
  import SharedScreen from "$lib/screens/shared/SharedScreen.svelte";
  import ChatChats from "./ChatChats.svelte";
  import ChatView from "./ChatView.svelte";
  import PaneHeader from "./PaneHeader.svelte";
  import PanelPreview, { previewFills } from "./PanelPreview.svelte";
  import PaneSurface from "./PaneSurface.svelte";
  import PaneTools from "./PaneTools.svelte";
  import TabStrip from "./TabStrip.svelte";
  import TerminalView from "./TerminalView.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import type { PaneDrag } from "./paneDrag";
  import { panes } from "./panes.svelte";
  import { providePaneTail } from "./paneSurface";
  import { tabs, type PaneRole } from "./tabs.svelte";

  interface Props {
    role?: PaneRole;
    instant: boolean;
    centerView: boolean;
    terminalCwd: string[];
    onPaneDrag?: PaneDrag;
    onTabDrag?: (id: string, pointerX: number) => boolean;
    onAgentTabDrag?: (id: string, pointerX: number) => boolean;
    lead?: Snippet;
  }

  const { role = "right", instant, centerView, terminalCwd, onPaneDrag, onTabDrag, onAgentTabDrag, lead }: Props =
    $props();

  const view = $derived(panes.viewAt(role));
  const openNote = $derived(panes.noteId === null ? null : notes.find(panes.noteId));

  const closeNote = () => {
    if (panes.noteId) notes.discardEmpty(panes.noteId);
    panes.noteId = null;
  };

  const focused = $derived(panes.focused === role);
  const group = $derived(panes.groupAt(role));
  const shownTab = $derived(panes.tabAt(role));
  const chatShown = $derived(group !== null && !!shownTab);
  const history = $derived(chatShown && panes.historyShown(role));
  const oneRow = $derived(layout.mobile && (!chatShown || history));
  const filled = $derived(previewFills(role));

  providePaneTail(() => (oneRow ? paneTail : null));

  $effect(() => {
    if (!panes.shows("claude")) panes.claudeDetail = null;
  });

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !panes.shownAt(role) || view !== "claude" || panes.claudeDetail === null) {
        return false;
      }
      panes.claudeDetail = null;
      return true;
    }),
  );

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !panes.shownAt(role) || view !== "notes" || panes.noteId === null) return false;
      closeNote();
      return true;
    }),
  );
</script>

{#if filled}
  <PanelPreview {role} />
{:else}
  <PaneSurface {role} plain={chatShown || view === "agents"}>
    {#if chatShown && shownTab && !history}
      <TabStrip
        items={group === "right" ? tabs.right : tabs.center}
        activeId={shownTab.id}
        onSelect={(id) => (group === "right" ? panes.showTab(id) : tabs.select(id))}
        onNew={() => panes.newTab()}
        newShortcut="tab.new"
        onClose={(id) => panes.close(id)}
        onMove={(id, index) => tabs.move(id, index)}
        onDrop={() => panes.dropTab()}
        {onPaneDrag}
        {onTabDrag}
        group="chat"
        {focused}
        trailing={chatActions}
      />
    {:else if !oneRow && view !== "agents"}
      <PaneTools {onPaneDrag} />
    {/if}
    <div class="relative flex min-h-0 flex-1 flex-col">
      {#if chatShown && shownTab}
        <ChatView chat={tabs.stateFor(shownTab)} viewKey={shownTab.id} {focused} />
        {#if history}
          <ChatChats chat={tabs.stateFor(shownTab)} {focused} {role} />
        {/if}
      {:else if view === "notes"}
        <PaneHeader
          title={openNote ? noteTitle(openNote) || t("NOTE_UNTITLED") : t("NOTES")}
          actions={notesActions}
          onBack={openNote ? closeNote : undefined}
        />
        {#if openNote}
          <NotesEditor note={openNote} />
        {:else}
          <NotesList onOpen={(id) => (panes.noteId = id)} />
        {/if}
      {:else if view === "shared"}
        <SharedScreen />
      {:else if view === "project"}
        <ProjectFilesScreen {instant} elsewhere={centerView} />
      {:else if view === "monitor"}
        <PaneHeader title={t("MONITOR")} actions={monitorActions} />
        <MonitorContent />
      {:else if view === "browser"}
        <BrowserView {focused} />
      {:else if view === "mods"}
        <ModsView chat={panes.focusedChat} />
      {:else if view === "agents"}
        <AgentsView
          {focused}
          {lead}
          trailing={oneRow ? undefined : chatActions}
          {onPaneDrag}
          onTabDrag={onAgentTabDrag}
        />
      {:else if view === "claude"}
        {#if panes.claudeDetail}
          <ClaudeDetail kind={panes.claudeDetail} onClose={() => (panes.claudeDetail = null)} />
        {:else}
          <PaneHeader title={t("CLAUDE")} actions={claudeActions} />
          <PullToRefresh refreshing={claudeRefresh.refreshing} onRefresh={() => void claudeRefresh.run()}>
            <div class="px-2 pb-2">
              <ClaudeSections
                tick={claudeRefresh.tick}
                onOpen={(kind) => (panes.claudeDetail = kind)}
                onAccountsChanged={() => void claudeRefresh.run()}
              />
            </div>
          </PullToRefresh>
        {/if}
      {:else}
        <TerminalView cwd={terminalCwd} />
      {/if}

      {#if panes.previewing && navigation.previewPane && navigation.preview && !centerView && panes.filesRole === role}
        {@const request = navigation.preview}
        <div class="absolute inset-0 z-20">
          <FilePreview
            embedded
            url={request.url}
            filename={request.name}
            forcedKind={request.kind}
            onDelete={request.onDelete}
            onClose={closeFilePreview}
            onExpand={expandFilePreview}
          />
        </div>
      {/if}
    </div>
  </PaneSurface>
{/if}

{#snippet chatActions()}
  <PaneTools tools={false} />
{/snippet}
{#snippet paneTail()}
  <span class="mx-1 h-5 w-px shrink-0 bg-outline-variant"></span>
  <PaneTools tools={false} />
{/snippet}

{#snippet notesActions()}
  <NotesActions
    note={openNote}
    onNew={() => (panes.noteId = notes.create())}
    onClosed={() => (panes.noteId = null)}
  />
{/snippet}

{#snippet monitorActions()}
  <MonitorActions />
{/snippet}

{#snippet claudeActions()}
  <ClaudeActions />
{/snippet}
