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
  import MonitorActions from "$lib/screens/monitor/MonitorActions.svelte";
  import MonitorContent from "$lib/screens/monitor/MonitorContent.svelte";
  import NotesActions from "$lib/screens/notes/NotesActions.svelte";
  import NotesEditor from "$lib/screens/notes/NotesEditor.svelte";
  import ProjectFilesScreen from "$lib/screens/project/ProjectFilesScreen.svelte";
  import FilePreview from "$lib/screens/shared/FilePreview.svelte";
  import SharedScreen from "$lib/screens/shared/SharedScreen.svelte";
  import ChatView from "./ChatView.svelte";
  import PaneActions from "./PaneActions.svelte";
  import PaneHeader from "./PaneHeader.svelte";
  import PaneSurface from "./PaneSurface.svelte";
  import TabStrip from "./TabStrip.svelte";
  import TerminalView from "./TerminalView.svelte";
  import { panes } from "./panes.svelte";
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

  const focused = $derived(panes.focused === "right");

  $effect(() => {
    if (panes.kind !== "claude") claudeDetail = null;
  });

  $effect(() =>
    navigation.intercept(() => {
      if (!navigation.chatActive || claudeDetail === null) return false;
      claudeDetail = null;
      return true;
    }),
  );
</script>

{#if panes.kind === "chat" && panes.rightTab}
  <PaneSurface>
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
      trailing={sideActions}
    />
    <ChatView tab={panes.rightTab} {focused} />
  </PaneSurface>
{:else if panes.kind === "notes"}
  <PaneSurface>
    <PaneHeader title={t("NOTES")} actions={notesActions} />
    <NotesEditor />
  </PaneSurface>
{:else if panes.kind === "shared"}
  <PaneSurface>
    <SharedScreen />
  </PaneSurface>
{:else if panes.kind === "project"}
  <PaneSurface>
    <ProjectFilesScreen {instant} elsewhere={centerView} />
  </PaneSurface>
{:else if panes.kind === "monitor"}
  <PaneSurface>
    <PaneHeader title={t("MONITOR")} actions={monitorActions} />
    <MonitorContent />
  </PaneSurface>
{:else if panes.kind === "browser"}
  <PaneSurface>
    <BrowserView trailing={sideActions} {focused} />
  </PaneSurface>
{:else if panes.kind === "claude"}
  <PaneSurface>
    {#if claudeDetail}
      <ClaudeDetail kind={claudeDetail} onClose={() => (claudeDetail = null)} />
    {:else}
      <PaneHeader title={t("CLAUDE")} actions={claudeActions} />
      <PullToRefresh refreshing={claudeRefresh.refreshing} onRefresh={() => void claudeRefresh.run()}>
        <div class="px-4 pb-4">
          <ClaudeSections
            tick={claudeRefresh.tick}
            onOpen={(kind) => (claudeDetail = kind)}
            onAccountsChanged={() => void claudeRefresh.run()}
          />
        </div>
      </PullToRefresh>
    {/if}
  </PaneSurface>
{:else}
  <PaneSurface>
    <TerminalView cwd={terminalCwd} />
  </PaneSurface>
{/if}

{#if panes.previewing && navigation.previewPane && navigation.preview && !centerView}
  {@const request = navigation.preview}
  <div class="absolute inset-0 z-20">
    <PaneSurface>
      <FilePreview
        embedded
        url={request.url}
        filename={request.name}
        onDelete={request.onDelete}
        onClose={closeFilePreview}
        onExpand={expandFilePreview}
      />
    </PaneSurface>
  </div>
{/if}

{#snippet sideActions()}
  <PaneActions />
{/snippet}

{#snippet notesActions()}
  <NotesActions />
{/snippet}

{#snippet monitorActions()}
  <MonitorActions />
{/snippet}

{#snippet claudeActions()}
  <ClaudeActions />
{/snippet}
