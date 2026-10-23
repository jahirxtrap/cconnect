<script lang="ts">
  import { closeFilePreview, expandFilePreview } from "$lib/app/filePreview";
  import { navigation } from "$lib/app/navigation.svelte";
  import { claudeRefresh } from "$lib/data/claudeRefresh.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import PullToRefresh from "$lib/ui/PullToRefresh.svelte";
  import ClaudeActions from "$lib/screens/claude/ClaudeActions.svelte";
  import ClaudeDetail, { type ClaudeKind } from "$lib/screens/claude/ClaudeDetail.svelte";
  import ClaudeSections from "$lib/screens/claude/ClaudeSections.svelte";
  import BrowserView from "$lib/screens/browser/BrowserView.svelte";
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
  import ChatView from "./ChatView.svelte";
  import PaneHeader from "./PaneHeader.svelte";
  import PaneSurface from "./PaneSurface.svelte";
  import PaneTools from "./PaneTools.svelte";
  import TabStrip from "./TabStrip.svelte";
  import TerminalView from "./TerminalView.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { panes } from "./panes.svelte";
  import { providePaneTail } from "./paneSurface";
  import { tabs } from "./tabs.svelte";

  interface Props {
    instant: boolean;
    centerView: boolean;
    terminalCwd: string[];
    onPaneDrag?: (pointerX: number, done: boolean) => void;
    onTabDrag?: (id: string, pointerX: number) => boolean;
  }

  const { instant, centerView, terminalCwd, onPaneDrag, onTabDrag }: Props = $props();

  let claudeDetail = $state<ClaudeKind | null>(null);
  let noteId = $state<string | null>(null);

  const openNote = $derived(noteId === null ? null : notes.find(noteId));

  const closeNote = () => {
    if (noteId) notes.discardEmpty(noteId);
    noteId = null;
  };

  const focused = $derived(panes.focused === "right");
  const chatShown = $derived(panes.kind === "chat" && !!panes.rightTab);
  const oneRow = $derived(layout.mobile && !chatShown);

  providePaneTail(() => (oneRow ? paneTail : null));

  $effect(() => {
    if (panes.kind !== "claude") claudeDetail = null;
  });

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !panes.open || claudeDetail === null) return false;
      claudeDetail = null;
      return true;
    }),
  );

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || !panes.open || noteId === null) return false;
      closeNote();
      return true;
    }),
  );
</script>

<PaneSurface plain={chatShown}>
  {#if chatShown && panes.rightTab}
    <TabStrip
      items={tabs.right}
      activeId={panes.rightTab?.id ?? null}
      onSelect={(id) => panes.showTab(id)}
      onNew={() => panes.newTab()}
      newShortcut="tab.new"
      onClose={(id) => panes.close(id)}
      onMove={(id, index) => tabs.move(id, index)}
      onDrop={() => tabs.commit()}
      {onPaneDrag}
      {onTabDrag}
      group="chat"
      {focused}
      trailing={chatActions}
    />
  {:else if !oneRow}
    <PaneTools />
  {/if}
  <div class="relative flex min-h-0 flex-1 flex-col">
    {#if chatShown && panes.rightTab}
      <ChatView tab={panes.rightTab} {focused} />
    {:else if panes.kind === "notes"}
      <PaneHeader
        title={openNote ? noteTitle(openNote) || t("NOTE_UNTITLED") : t("NOTES")}
        actions={notesActions}
        onBack={openNote ? closeNote : undefined}
      />
      {#if openNote}
        <NotesEditor note={openNote} />
      {:else}
        <NotesList onOpen={(id) => (noteId = id)} />
      {/if}
    {:else if panes.kind === "shared"}
      <SharedScreen />
    {:else if panes.kind === "project"}
      <ProjectFilesScreen {instant} elsewhere={centerView} />
    {:else if panes.kind === "monitor"}
      <PaneHeader title={t("MONITOR")} actions={monitorActions} />
      <MonitorContent />
    {:else if panes.kind === "browser"}
      <BrowserView {focused} />
    {:else if panes.kind === "mods"}
      <ModsView chat={panes.focusedChat} />
    {:else if panes.kind === "claude"}
      {#if claudeDetail}
        <ClaudeDetail kind={claudeDetail} onClose={() => (claudeDetail = null)} />
      {:else}
        <PaneHeader title={t("CLAUDE")} actions={claudeActions} />
        <PullToRefresh refreshing={claudeRefresh.refreshing} onRefresh={() => void claudeRefresh.run()}>
          <div class="px-2 pb-2">
            <ClaudeSections
              tick={claudeRefresh.tick}
              onOpen={(kind) => (claudeDetail = kind)}
              onAccountsChanged={() => void claudeRefresh.run()}
            />
          </div>
        </PullToRefresh>
      {/if}
    {:else}
      <TerminalView cwd={terminalCwd} />
    {/if}

    {#if panes.previewing && navigation.previewPane && navigation.preview && !centerView}
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

{#snippet chatActions()}
  <PaneTools tools={false} />
{/snippet}

{#snippet paneTail()}
  <span class="mx-1 h-5 w-px shrink-0 bg-outline-variant"></span>
  <PaneTools tools={false} />
{/snippet}

{#snippet notesActions()}
  <NotesActions note={openNote} onNew={() => (noteId = notes.create())} onClosed={() => (noteId = null)} />
{/snippet}

{#snippet monitorActions()}
  <MonitorActions />
{/snippet}

{#snippet claudeActions()}
  <ClaudeActions />
{/snippet}
