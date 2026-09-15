<script module lang="ts">
  const opened = $state<{ project: string | null; path: string | null; full: boolean }>({
    project: null,
    path: null,
    full: false,
  });
</script>

<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import AtSign from "@lucide/svelte/icons/at-sign";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import FileDiff from "@lucide/svelte/icons/file-diff";
  import GitCompare from "@lucide/svelte/icons/git-compare";
  import Lock from "@lucide/svelte/icons/lock";
  import Search from "@lucide/svelte/icons/search";
  import { untrack } from "svelte";
  import { activeScope } from "$lib/app/activeScope.svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { isEditing, paneFocus } from "$lib/data/paneFocus.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { paneActionClass } from "$lib/screens/chat/paneChrome";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { projectFilePath } from "$lib/data/models";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { copyText } from "$lib/platform/clipboard";
  import { backend } from "$lib/services/backend.svelte";
  import {
    projectFileUrl,
    projectFilesApi,
    type ProjectDiff,
    type ProjectEntry,
  } from "$lib/services/projectFilesApi";
  import { gitApi, type GitRepo } from "$lib/services/gitApi";
  import { ProjectWatch } from "$lib/services/projectWatch.svelte";
  import { recallProject, rememberProject } from "./projectMemory";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { fileIcon, projectIcon } from "$lib/ui/fileIcons";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import SelectionDot from "$lib/ui/SelectionDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import FilePreview, { type ToolbarButton } from "$lib/screens/shared/FilePreview.svelte";
  import CommitBar from "./CommitBar.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import ProjectSelector from "$lib/screens/chat/ProjectSelector.svelte";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import { tabs } from "$lib/screens/chat/tabs.svelte";

  const INDENT = 14;
  const BASE_INDENT = 8;
  const SEARCH_DELAY_MS = 200;

  const compact = inPane();
  const watch = new ProjectWatch();

  const chat = $derived(tabs.state);
  const projects = $derived(chatListFor(backend.active)?.projects ?? []);

  let children = $state<Record<string, ProjectEntry[]>>({});
  let expanded = $state<Record<string, boolean>>({});
  let searching = $state(false);
  let query = $state("");
  let results = $state<ProjectEntry[] | null>(null);
  let tracked = $state(false);
  let locked = $state(false);
  let showDiff = $state(settings.projectDiff);
  let fileDiff = $state<ProjectDiff | null>(null);
  let showChanged = $state(settings.projectChangedOnly);
  let changed = $state<ProjectEntry[] | null>(null);
  let repos = $state<GitRepo[] | null>(null);
  let picked = $state<Record<string, boolean>>({});

  const files = $derived((changed ?? []).filter((entry) => !entry.isDir && entry.repoPath));
  const chosen = $derived(files.filter((entry) => picked[entry.path] === true));
  const committing = $derived(showChanged && settings.projectCommitOpen);

  const commitRepo = $derived.by(() => {
    const listed = repos ?? [];
    const wanted = chosen[0]?.repoRoot ?? files[0]?.repoRoot ?? "";
    return listed.find((item) => item.path === wanted) ?? listed[0] ?? null;
  });

  const commitPaths = $derived(
    commitRepo ? chosen.filter((entry) => entry.repoRoot === commitRepo.path).map((entry) => entry.repoPath) : [],
  );

  const selectAll = () => {
    const turningOn = chosen.length < files.length;
    for (const entry of files) picked[entry.path] = turningOn;
  };

  useShortcut("project.selectAll", () => {
    if (activeScope() !== "project" || isEditing() || !committing || !files.length) return false;
    selectAll();
  });

  const showChanges = (value: boolean) => {
    showChanged = value;
    settings.projectChangedOnly = value;
  };

  useShortcut("project.changes", () => {
    if (activeScope() !== "project" || !projectKey) return false;
    showChanges(!showChanged);
  });

  useShortcut("project.commit", () => {
    if (activeScope() !== "project" || !projectKey) return false;
    if (!showChanged) {
      showChanges(true);
      settings.projectCommitOpen = true;
      return;
    }
    settings.projectCommitOpen = !settings.projectCommitOpen;
  });

  const togglePick = (entry: ProjectEntry) => {
    const targets = entry.isDir
      ? files.filter((item) => item.path.startsWith(`${entry.path}/`))
      : files.filter((item) => item.path === entry.path);
    const turningOn = targets.some((item) => picked[item.path] !== true);
    for (const item of targets) picked[item.path] = turningOn;
  };

  const marked = (entry: ProjectEntry) =>
    entry.isDir
      ? files.some((item) => item.path.startsWith(`${entry.path}/`) && picked[item.path] === true)
      : picked[entry.path] === true;
  let anchorAt = $state<number | null>(null);
  let unlocking = $state(false);
  let rejected = $state(false);
  let loading = $state(false);

  const projectKey = $derived(
    settings.lockedProject ||
      (opened.project ?? chat.historyProject ?? tabs.active?.projectKey ?? projects[0]?.projectKey ?? null),
  );

  const project = $derived(projects.find((item) => item.projectKey === projectKey) ?? null);

  const openEntry = $derived(
    opened.path === null
      ? null
      : ([...(changed ?? []), ...(results ?? []), ...Object.values(children).flat()].find(
          (item) => item.path === opened.path,
        ) ?? null),
  );

  const modified = $derived(!!openEntry?.status && !openEntry.status.startsWith("?"));

  const anchors = $derived.by(() => {
    if (!showDiff || !fileDiff) return [];
    const starts = new Set(Object.keys(fileDiff.removed).map(Number));
    let previous = -1;
    for (const line of [...fileDiff.added].sort((first, second) => first - second)) {
      if (line !== previous + 1) starts.add(line);
      previous = line;
    }
    return [...starts].sort((first, second) => first - second);
  });

  const anchor = $derived(anchorAt === null ? null : (anchors[anchorAt] ?? null));

  const current = $derived.by(() => {
    if (anchor === null || !fileDiff) return [];
    const lines = new Set(fileDiff.added);
    if (!lines.has(anchor)) return [];
    const block = [anchor];
    let line = anchor;
    while (lines.has(line + 1)) {
      line += 1;
      block.push(line);
    }
    return block;
  });

  const step = (delta: number) => {
    const at = anchorAt === null ? 0 : anchorAt + delta;
    anchorAt = Math.min(Math.max(at, 0), anchors.length - 1);
  };

  $effect(() => {
    void chat.historyProject;
    opened.project = null;
  });

  const closeFile = () => {
    opened.path = null;
    opened.full = false;
  };

  $effect(() =>
    navigation.intercept(() => {
      if (opened.path === null) return false;
      closeFile();
      return true;
    }),
  );

  const unlock = (key: string) => {
    securityKeys.set(key);
    rejected = false;
    watch.refresh();
  };

  interface Row {
    entry: ProjectEntry;
    depth: number;
  }

  const rows = $derived.by(() => {
    const listed: Row[] = [];
    const walk = (path: string, depth: number) => {
      for (const entry of children[path] ?? []) {
        listed.push({ entry, depth });
        if (entry.isDir && expanded[entry.path]) walk(entry.path, depth + 1);
      }
    };
    walk("", 0);
    return listed;
  });

  const folderEntry = (path: string, name: string): ProjectEntry => ({
    name,
    path,
    isDir: true,
    size: 0,
    modified: 0,
    items: 0,
    status: "",
    ignored: false,
    repo: (repos ?? []).some((item) => item.relative === path),
    repoRoot: "",
    repoPath: "",
  });

  interface Branch {
    name: string;
    path: string;
    entry: ProjectEntry | null;
    folders: Map<string, Branch>;
  }

  const branchOf = (parent: Branch, name: string): Branch => {
    const path = parent.path ? `${parent.path}/${name}` : name;
    let found = parent.folders.get(name);
    if (!found) {
      found = { name, path, entry: null, folders: new Map() };
      parent.folders.set(name, found);
    }
    return found;
  };

  const changedTree = $derived.by(() => {
    const root: Branch = { name: "", path: "", entry: null, folders: new Map() };
    for (const entry of changed ?? []) {
      const segments = entry.path.split("/");
      let branch = root;
      for (const segment of segments.slice(0, -1)) branch = branchOf(branch, segment);
      branchOf(branch, segments[segments.length - 1]).entry = entry;
    }
    return root;
  });

  const changedRows = $derived.by(() => {
    const listed: Row[] = [];
    const walk = (branch: Branch, depth: number) => {
      for (const child of branch.folders.values()) {
        if (child.entry) {
          listed.push({ entry: child.entry, depth });
          continue;
        }
        let folded = child;
        let name = child.name;
        while (folded.folders.size === 1 && !folded.folders.values().next().value!.entry) {
          folded = folded.folders.values().next().value!;
          name = `${name}/${folded.name}`;
        }
        listed.push({ entry: folderEntry(folded.path, name), depth });
        if (expanded[folded.path]) walk(folded, depth + 1);
      }
    };
    walk(changedTree, 0);
    return listed;
  });

  const entryClass = (entry: ProjectEntry) =>
    entry.ignored
      ? "text-on-surface-variant/60"
      : !entry.status
        ? ""
        : entry.status.startsWith("?")
          ? "text-green"
          : entry.status.includes("D")
            ? "text-red"
            : "text-blue";

  const toggle = async (entry: ProjectEntry) => {
    const key = projectKey;
    if (!key) return;
    const opening = !expanded[entry.path];
    expanded = { ...expanded, [entry.path]: opening };
    if (!opening || children[entry.path]) return;
    const listing = await projectFilesApi.tree(key, entry.path);
    if (listing && projectKey === key) children = { ...children, [entry.path]: listing.entries };
  };

  const absolute = $derived(opened.path === null ? "" : projectFilePath(project?.path ?? null, opened.path));

  const mention = () => {
    const chat = tabs.state;
    chat.draft = chat.draft ? `${chat.draft} @${absolute}` : `@${absolute}`;
  };

  const open = (entry: ProjectEntry) => {
    opened.project = projectKey;
    anchorAt = null;
    opened.path = entry.path;
  };

  const fold = (path: string) => {
    expanded = { ...expanded, [path]: !expanded[path] };
  };

  const activate = (entry: ProjectEntry) => {
    if (entry.isDir) void toggle(entry);
    else open(entry);
  };

  const slot = $derived(`${backend.activeId ?? ""}|${projectKey ?? ""}`);

  let placed = "";

  $effect(() => {
    const target = slot;
    if (target === placed) return;
    untrack(() => {
      if (compact && placed) rememberProject(placed, { children, expanded, path: opened.path });
      placed = target;
      results = null;
      const saved = compact ? recallProject(target) : undefined;
      children = saved?.children ?? {};
      expanded = saved?.expanded ?? {};
      if (saved?.path) opened.path = saved.path;
      else closeFile();
    });
  });

  $effect(() => {
    const key = projectKey;
    void watch.revision;
    const known = untrack(() => Object.keys(children));
    if (!key) {
      loading = false;
      return;
    }
    const targets = known.length ? known : [""];
    loading = !known.length;
    void Promise.all(
      targets.map((path) => projectFilesApi.tree(key, path).then((listing) => [path, listing] as const)),
    ).then((loaded) => {
      if (projectKey !== key) return;
      loading = false;
      const root = loaded.find(([path]) => path === "")?.[1];
      children = Object.fromEntries(
        loaded.filter(([, listing]) => listing).map(([path, listing]) => [path, listing!.entries]),
      );
      if (!root) return;
      tracked = root.tracked;
      locked = !root.unlocked;
      if (unlocking) rejected = locked;
      unlocking = unlocking && locked;
      if (!tracked) {
        searching = false;
        query = "";
      }
    });
  });

  $effect(() => {
    watch.connect();
    return () => watch.close();
  });

  $effect(() => {
    if (projectKey) watch.watch(projectKey);
  });

  $effect(() => {
    const key = projectKey;
    const target = opened.path;
    void watch.revision;
    if (!key || target === null || !showDiff) {
      fileDiff = null;
      return;
    }
    void projectFilesApi.diff(key, target).then((found) => {
      if (projectKey === key && opened.path === target) fileDiff = found;
    });
  });

  $effect(() => {
    const key = projectKey;
    void watch.revision;
    if (!key || !showChanged) {
      changed = null;
      return;
    }
    void projectFilesApi.changes(key).then((found) => {
      if (projectKey !== key || !showChanged) return;
      changed = found;
    });
  });

  $effect(() => {
    const key = projectKey;
    void watch.revision;
    if (!key || !showChanged) {
      repos = null;
      return;
    }
    void gitApi.repos(key).then((found) => {
      if (projectKey === key && showChanged) repos = found;
    });
  });

  $effect(() => {
    const key = projectKey;
    const needle = query.trim();
    if (!searching || !needle || !key) {
      results = null;
      return;
    }
    const timer = setTimeout(() => {
      void projectFilesApi.search(key, needle).then((found) => {
        if (searching && query.trim() === needle && projectKey === key) results = found;
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  });
</script>

{#snippet headerActions()}
  {#if tracked}
    <TooltipIconButton
      label={t("SEARCH")}
      class={compact ? "size-8" : ""}
      onclick={() => {
        searching = !searching;
        if (!searching) query = "";
      }}
    >
      <Search class={searching ? "text-accent" : ""} />
    </TooltipIconButton>
  {/if}
  {#if locked}
    <TooltipIconButton
      label={t("UNLOCK")}
      class={compact ? "size-8" : ""}
      onclick={() => {
        rejected = false;
        unlocking = true;
      }}
    >
      <Lock />
    </TooltipIconButton>
  {/if}
  {#if projectKey}
    <TooltipIconButton
      label={t("CHANGED_FILES")}
      class={paneActionClass(compact)}
      shortcut="project.changes"
      onclick={() => showChanges(!showChanged)}
    >
      <GitCompare class={showChanged ? "text-accent" : ""} />
    </TooltipIconButton>
  {/if}
{/snippet}

{#snippet diffToggle(button: ToolbarButton)}
  {#if anchors.length}
    <TooltipIconButton
      label={t("PREVIOUS_CHANGE")}
      class={button.class}
      enabled={anchorAt !== null && anchorAt > 0}
      onclick={() => step(-1)}
    >
      <ChevronUp size={button.size} />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("NEXT_CHANGE")}
      class={button.class}
      enabled={anchorAt === null || anchorAt < anchors.length - 1}
      onclick={() => step(1)}
    >
      <ChevronDown size={button.size} />
    </TooltipIconButton>
  {/if}
  <TooltipIconButton
    label={t("DIFF")}
    class={button.class}
    onclick={() => {
      showDiff = !showDiff;
      settings.projectDiff = showDiff;
    }}
  >
    <FileDiff size={button.size} class={showDiff ? "text-accent" : ""} />
  </TooltipIconButton>
{/snippet}

{#snippet fileMenu()}
  <MenuItem text={t("MENTION_IN_CHAT")} onclick={mention}>
    {#snippet leading()}
      <AtSign size={20} class="shrink-0 text-on-surface-variant" />
    {/snippet}
  </MenuItem>
{/snippet}

{#snippet pathRow(entry: ProjectEntry)}
  <Pressable
    onclick={() => !entry.status.includes("D") && open(entry)}
    class="flex w-full items-center gap-2 px-3 py-1.5 text-left"
  >
    {@const Icon = fileIcon(entry.path)}
    <Icon size={16} class="shrink-0 text-on-surface-variant" />
    <span class="min-w-0 flex-1 truncate text-body-md {entryClass(entry)}">{entry.path}</span>
  </Pressable>
{/snippet}

{#snippet selectAllAction()}
  <TooltipIconButton
    label={t("SELECT_ALL")}
    class={paneActionClass(compact)}
    shortcut="project.selectAll"
    onclick={selectAll}
  >
    <SelectionDot selected={files.length > 0 && chosen.length === files.length} size={compact ? 18 : 24} />
  </TooltipIconButton>
{/snippet}

{#snippet changedRow(entry: ProjectEntry, depth: number, open: boolean, action: () => void)}
  <div
    class="flex w-full items-center transition-colors hover:bg-on-surface/8"
    oncontextmenu={(event) => {
      event.preventDefault();
      togglePick(entry);
    }}
    role="presentation"
  >
    {#if committing}
      <button
        type="button"
        onclick={() => togglePick(entry)}
        aria-label={entry.name}
        class="flex shrink-0 cursor-pointer items-center py-1.5 pl-4"
      >
        <SelectionDot selected={marked(entry)} size={16} />
      </button>
    {/if}
    <div class="min-w-0 flex-1">
      {@render fileRow(entry, depth, open, action, false, committing ? 4 : BASE_INDENT)}
    </div>
  </div>
{/snippet}

{#snippet fileRow(
  entry: ProjectEntry,
  depth: number,
  open: boolean,
  action: () => void,
  hover = true,
  base = BASE_INDENT,
)}
  {@const Icon = projectIcon(entry.path, entry.isDir, entry.repo)}
  <Pressable onclick={action} {hover} class="flex w-full items-center gap-1.5 py-1.5 pr-4 text-left">
    <span style="width: {base + depth * INDENT}px" class="shrink-0"></span>
    <span class="flex size-4 shrink-0 items-center justify-center">
      {#if entry.isDir}
        <ChevronRight size={14} class="text-on-surface-variant {open ? 'rotate-90' : ''}" />
      {/if}
    </span>
    <Icon size={16} class="shrink-0 text-on-surface-variant" />
    <span class="min-w-0 flex-1 truncate text-body-md {entryClass(entry)}">{entry.name}</span>
  </Pressable>
{/snippet}

<div
  class="relative flex h-full min-h-0 flex-col"
  onpointerdowncapture={() => paneFocus.set("project")}
>
  {#if compact}
    <PaneHeader
      title={t("PROJECT_FILES")}
      leading={committing ? selectAllAction : undefined}
      actions={headerActions}
    />
  {:else}
    <AppTopBar title={t("PROJECT_FILES")} subtitle={project?.name ?? null}>
      {#snippet navigationIcon()}
        {#if committing}
          {@render selectAllAction()}
        {:else}
          <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
            <ArrowLeft size={20} />
          </TooltipIconButton>
        {/if}
      {/snippet}
      {#snippet actions()}
        {@render headerActions()}
      {/snippet}
    </AppTopBar>
  {/if}

  {#if projects.length > 1}
    <div class="px-2 pt-2">
      <ProjectSelector {projects} selected={projectKey} allowAll={false} onSelect={(key) => (opened.project = key)} />
    </div>
  {/if}

  {#if searching}
    <div class="px-3 py-2">
      <SearchBar
        value={query}
        oninput={(value) => (query = value)}
        placeholder={t("SEARCH")}
        autofocus
        large={!compact}
        onClose={() => {
          searching = false;
          query = "";
        }}
      />
    </div>
  {/if}

  <div class="min-h-0 flex-1 overflow-y-auto pb-2">
    {#if loading}
      <CenteredProgress class="h-full" />
    {:else if !projectKey}
      <EmptyState text={serverStatus.unavailable ? t("SERVER_UNAVAILABLE") : t("NO_PROJECTS")} class="h-full" />
    {:else if showChanged && changed === null}
      <CenteredProgress class="h-full" />
    {:else if showChanged}
      {#each changedRows as row (row.entry.path)}
        {@render changedRow(row.entry, row.depth, expanded[row.entry.path] === true, () =>
          row.entry.isDir ? fold(row.entry.path) : open(row.entry),
        )}
      {:else}
        <EmptyState text={t("NO_CHANGES")} class="h-full" />
      {/each}
    {:else if results !== null}
      {#each results as entry (entry.path)}
        {@render pathRow(entry)}
      {:else}
        <EmptyState text={t("NO_RESULTS")} class="h-full" />
      {/each}
    {:else}
      {#each rows as row (row.entry.path)}
        {@render fileRow(row.entry, row.depth, expanded[row.entry.path] === true, () =>
          activate(row.entry),
        )}
      {:else}
        <EmptyState text={t("NO_FILES")} class="h-full" />
      {/each}
    {/if}
  </div>

  {#if showChanged && commitRepo && projectKey}
    <CommitBar
      {projectKey}
      repo={commitRepo}
      paths={commitPaths}
      onDone={() => watch.refresh()}
    />
  {/if}

  {#if opened.path !== null && projectKey}
    <div class={opened.full ? "" : "absolute inset-0 z-10"}>
      <FilePreview
        url={projectFileUrl(projectKey, opened.path)}
        filename={opened.path.split("/").at(-1) ?? opened.path}
        embedded={compact && !opened.full}
        menuItems={fileMenu}
        onCopyPath={() => void copyText(absolute)}
        actions={modified ? diffToggle : undefined}
        added={showDiff ? (fileDiff?.added ?? []) : []}
        removed={showDiff ? (fileDiff?.removed ?? {}) : {}}
        {current}
        {anchor}
        onExpand={compact && !opened.full ? () => (opened.full = true) : null}
        onClose={closeFile}
      />
    </div>
  {/if}
</div>

{#if unlocking}
  <SecurityKeyDialog
    title={t("FILES_LOCKED")}
    {rejected}
    onConfirm={unlock}
    onDismiss={() => {
      unlocking = false;
      rejected = false;
    }}
  />
{/if}
