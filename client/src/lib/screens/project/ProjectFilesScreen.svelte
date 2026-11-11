<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FolderClosed from "@lucide/svelte/icons/folder-closed";
  import FolderGit2 from "@lucide/svelte/icons/folder-git-2";
  import GitCompare from "@lucide/svelte/icons/git-compare";
  import History from "@lucide/svelte/icons/history";
  import Lock from "@lucide/svelte/icons/lock";
  import Search from "@lucide/svelte/icons/search";
  import { untrack } from "svelte";
  import { activeScope } from "$lib/app/activeScope.svelte";
  import { dismissOpen } from "$lib/app/dismissStack";
  import { navigation } from "$lib/app/navigation.svelte";
  import { isEditing, paneFocus } from "$lib/data/paneFocus.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { compareText, isArchive, joined } from "$lib/data/format";
  import { keepUnchanged } from "$lib/data/stableList";
  import { openFilePreview } from "$lib/app/filePreview";
  import { projectFilePath, projectLabel, type ProjectInfo } from "$lib/data/models";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { formatDateShort, MILLIS_PER_SECOND } from "$lib/data/time";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import { copyText } from "$lib/platform/clipboard";
  import { layout } from "$lib/platform/layout.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { projectArchiveFileUrl, projectFilesApi, projectFileUrl, type ProjectEntry } from "$lib/services/projectFilesApi";
  import { sharedApi } from "$lib/services/sharedApi";
  import { gitApi, type GitCommit, type GitRepo } from "$lib/services/gitApi";
  import { ProjectWatch } from "$lib/services/projectWatch.svelte";
  import { recallProject, rememberProject } from "./projectMemory";
  import { BAR_DOCK_CLASS, BAR_REGION_CLASS } from "$lib/ui/actionBar";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState, { NO_RESULTS_ICON } from "$lib/ui/EmptyState.svelte";
  import FileActionItems from "$lib/ui/FileActionItems.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import { fileIcon, projectIcon } from "$lib/ui/fileIcons";
  import { nearEdge } from "$lib/ui/paging";
  import Pressable from "$lib/ui/Pressable.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import { RowWindow } from "$lib/ui/rowWindow.svelte";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import SelectionDot from "$lib/ui/SelectionDot.svelte";
  import { FILE_ACTIONS, fileEntries, type FileActionEntry } from "$lib/ui/sharedFileActions";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import CommitBar from "./CommitBar.svelte";
  import { mentionInChat } from "$lib/screens/chat/mention";
  import ProjectDiffView, { diffCounts } from "./ProjectDiffView.svelte";
  import { closeProjectFile, opened, openProjectFile } from "$lib/app/viewer.svelte";
  import { projectDiffs } from "./projectDiffs.svelte";
  import ProjectSelector from "$lib/screens/chat/ProjectSelector.svelte";
  import { PANE_TOP_CLASS } from "$lib/screens/chat/paneChrome";
  import { inPane, usePaneTail } from "$lib/screens/chat/paneSurface";
  import { panelProject } from "$lib/screens/chat/panelProject.svelte";
  import { serverSettings } from "$lib/data/serverSettings.svelte";

  interface Props {
    instant?: boolean;
    elsewhere?: boolean;
  }

  const { instant = false, elsewhere = false }: Props = $props();

  const ARCHIVE_MARK = "!";
  const INDENT = 14;
  const ROW_CLASS = "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left";
  const LIST_FRAME = "flex-1 rounded-panel";
  const SEARCH_DELAY_MS = 200;
  const RAIL_X = 18;
  const RAIL_GAP = 18;
  const HEAD_SIZE = 16;
  const DOT_SIZE = 8;
  const DOT_BOX = 20;
  const RING_STROKE = 2;
  const HALF = 2;

  const compact = inPane();
  const tailOf = usePaneTail();
  const tail = $derived(tailOf());
  const watch = new ProjectWatch();

  const expandable = $derived(compact && !layout.mobile);
  const fullFile = $derived(opened.full && expandable);

  const list = $derived(chatListFor(backend.active));
  const projects = $derived(list?.visibleProjects ?? []);

  let children = $state.raw<Record<string, ProjectEntry[]>>({});
  let listingRun = 0;
  const listingRuns: Record<string, number> = {};
  let expanded = $state.raw<Record<string, boolean>>({});
  let searching = $state(false);
  let query = $state("");
  let results = $state.raw<ProjectEntry[] | null>(null);
  let tracked = $state(false);
  let locked = $state(false);
  let showChanged = $state(settings.projectChangedOnly);
  let changed = $state<ProjectEntry[] | null>(null);
  let changesSlot = "";
  let showLog = $state(false);
  let commits = $state<GitCommit[] | null>(null);
  let logDone = $state(false);
  let logPaging = $state(false);
  let repos = $state<GitRepo[] | null>(null);
  let repoRoot = $state<string | null>(null);
  let gitTick = $state(0);
  let picked = $state<Record<string, boolean>>({});

  const gitMissing = $derived(serverSettings.capabilitiesFor(backend.active)?.git === false);

  $effect(() => serverSettings.ensure());
  const repoList = $derived(repos ?? []);
  const activeRepo = $derived(
    repoList.find((item) => item.path === repoRoot) ?? (repoList.length === 1 ? repoList[0] : null),
  );
  const insideRepo = $derived(activeRepo !== null && repoList.length > 1);

  const files = $derived(
    activeRepo
      ? (changed ?? []).filter(
          (entry) => !entry.isDir && entry.repoPath && entry.repoRoot === activeRepo.path,
        )
      : [],
  );
  const chosen = $derived(files.filter((entry) => picked[entry.path] === true));
  const committing = $derived(
    showChanged && !showLog && activeRepo !== null && settings.projectCommitOpen && !locked,
  );
  const selectable = $derived(committing && files.length > 0);

  const repoCounts = $derived.by(() => {
    const counted: Record<string, number> = {};
    for (const entry of changed ?? []) {
      if (entry.isDir || !entry.repoPath) continue;
      counted[entry.repoRoot] = (counted[entry.repoRoot] ?? 0) + 1;
    }
    return counted;
  });

  const repoRows = $derived(
    [...repoList].sort(
      (first, second) =>
        Number((repoCounts[second.path] ?? 0) > 0) - Number((repoCounts[first.path] ?? 0) > 0) ||
        compareText(first.name, second.name),
    ),
  );

  const changeCount = $derived(
    changed === null
      ? null
      : (activeRepo ? files.length : Object.values(repoCounts).reduce((total, count) => total + count, 0)) || null,
  );

  const commitPaths = $derived(chosen.map((entry) => entry.repoPath));

  const unpushed = $derived(
    activeRepo ? (activeRepo.upstream ? activeRepo.ahead : (commits?.length ?? 0)) : 0,
  );

  const loadOlderCommits = () => {
    const key = projectKey;
    const target = activeRepo?.path ?? "";
    const cursor = commits?.at(-1)?.hash ?? "";
    if (!key || !target || !cursor || !showLog || logDone || logPaging) return;
    logPaging = true;
    void gitApi.log(key, target, cursor).then((found) => {
      logPaging = false;
      if (projectKey !== key || activeRepo?.path !== target || !showLog || !found) return;
      if (!found.length) {
        logDone = true;
        return;
      }
      commits = [...(commits ?? []), ...found];
    });
  };

  const onListScroll = (event: UIEvent) => {
    if (!showLog) return;
    if (nearEdge(event.currentTarget as HTMLElement)) loadOlderCommits();
  };

  const enterRepo = (repo: GitRepo) => {
    repoRoot = repo.path;
    picked = {};
  };

  const leaveRepo = () => {
    if (!insideRepo) return false;
    repoRoot = null;
    picked = {};
    return true;
  };

  const selectAll = () => {
    const turningOn = chosen.length < files.length;
    for (const entry of files) picked[entry.path] = turningOn;
  };

  const viewing = $derived(opened.path !== null);

  useShortcut("project.selectAll", () => {
    if (activeScope() !== "project" || isEditing() || viewing || !committing || !files.length) {
      return false;
    }
    selectAll();
  });

  const engaged = $derived(activeScope() === "project");

  const showingFile = $derived(opened.path !== null && !elsewhere);

  const cancelMode = () => {
    if (showingFile) return false;
    if (chosen.length) {
      picked = {};
      return true;
    }
    if (searching) {
      searching = false;
      query = "";
      return true;
    }
    if (showLog) {
      showLog = false;
      return true;
    }
    return false;
  };

  const leaveProject = () => {
    if (!pinned) return false;
    panelProject.pin("");
    return true;
  };

  const leaveView = () => {
    if (!showingFile) return leaveRepo();
    closeFile();
    return true;
  };

  const stepUp = () => leaveView() || leaveProject();

  const stepBack = () => (isTouch ? cancelMode() || leaveView() : leaveView() || cancelMode());

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !engaged || isEditing() || dismissOpen()) return;
    if (!cancelMode() && !stepUp()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  $effect(() => {
    window.addEventListener("keydown", onKeydown, true);
    return () => window.removeEventListener("keydown", onKeydown, true);
  });

  const showChanges = (value: boolean) => {
    showChanged = value;
    settings.projectChangedOnly = value;
    if (!value) showLog = false;
  };

  const toggleChanges = () => {
    if (showLog) showLog = false;
    else showChanges(!showChanged);
  };

  const pickView = (index: number) => {
    if (index === 0) showChanges(false);
    else if (showLog) showLog = false;
    else showChanges(true);
  };

  useShortcut("project.changes", () => {
    if (activeScope() !== "project" || viewing || !projectKey) return false;
    toggleChanges();
  });

  useShortcut("project.commit", () => {
    if (activeScope() !== "project" || viewing || !projectKey || locked) return false;
    if (!showChanged) {
      showChanges(true);
      settings.projectCommitOpen = true;
      return;
    }
    settings.projectCommitOpen = !settings.projectCommitOpen;
  });

  const inFolder = (entry: ProjectEntry, item: ProjectEntry) =>
    item.repoPath.startsWith(`${entry.path}/`);

  const togglePick = (entry: ProjectEntry) => {
    const targets = entry.isDir
      ? files.filter((item) => inFolder(entry, item))
      : files.filter((item) => item.path === entry.path);
    const turningOn = targets.some((item) => picked[item.path] !== true);
    for (const item of targets) picked[item.path] = turningOn;
  };

  const pickedFolders = $derived.by(() => {
    const folders = new Set<string>();
    for (const item of files) {
      if (picked[item.path] !== true) continue;
      const segments = item.repoPath.split("/");
      for (let depth = 1; depth < segments.length; depth++) folders.add(segments.slice(0, depth).join("/"));
    }
    return folders;
  });

  const marked = (entry: ProjectEntry) =>
    entry.isDir ? pickedFolders.has(entry.path) : picked[entry.path] === true;

  let unlocking = $state(false);
  let rejected = $state(false);
  let loading = $state(false);

  const pinned = $derived(panelProject.pinned);
  const projectKey = $derived(panelProject.key);

  $effect(() => {
    if (panelProject.settled && pinned && !panelProject.known(pinned)) panelProject.pin(null);
  });

  const project = $derived(projects.find((item) => item.projectKey === projectKey) ?? null);

  const closeFile = closeProjectFile;

  $effect(() => (engaged ? navigation.intercept(stepBack) : undefined));

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

  const treeWindow = new RowWindow(() => rows.length);

  const folderEntry = (path: string, name: string): ProjectEntry => ({
    name,
    path,
    isDir: true,
    size: 0,
    modified: 0,
    items: 0,
    status: "",
    ignored: false,
    repo: false,
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
    for (const entry of files) {
      const segments = entry.repoPath.split("/");
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

  const changedWindow = new RowWindow(() => changedRows.length);

  const resultsWindow = new RowWindow(() => results?.length ?? 0);

  const fold = (path: string) => {
    expanded = { ...expanded, [path]: !expanded[path] };
  };

  const entryClass = (entry: ProjectEntry) =>
    entry.ignored
      ? "text-faint"
      : !entry.status
        ? ""
        : entry.status.startsWith("?")
          ? "text-green"
          : entry.status.includes("D")
            ? "text-red"
            : "text-blue";

  const countsOf = (entry: ProjectEntry) =>
    projectKey ? diffCounts(projectDiffs.get(projectKey, entry.path)) : null;

  const archiveOf = (path: string) => path.split(ARCHIVE_MARK)[0];
  const innerOf = (path: string) => path.split(ARCHIVE_MARK).slice(1).join(ARCHIVE_MARK);
  const insideArchive = (path: string) => path.includes(ARCHIVE_MARK);
  const opensArchive = (entry: ProjectEntry) => !entry.isDir && isArchive(entry.name);

  const archiveChildren = async (key: string, path: string): Promise<ProjectEntry[] | null> => {
    const inner = innerOf(path);
    const found = await projectFilesApi.archive(key, archiveOf(path), inner);
    if (!found) return null;
    const base = inner ? `${path}/` : `${path}${ARCHIVE_MARK}`;
    return found.map((entry) => ({ ...entry, path: `${base}${entry.name}` }));
  };

  const toggle = async (entry: ProjectEntry) => {
    const key = projectKey;
    if (!key) return;
    const opening = !expanded[entry.path];
    expanded = { ...expanded, [entry.path]: opening };
    if (!opening || children[entry.path]) return;
    const archived = insideArchive(entry.path) || opensArchive(entry);
    const entries = archived
      ? await archiveChildren(key, entry.path)
      : (await projectFilesApi.tree(key, entry.path))?.entries ?? null;
    if (entries && projectKey === key) children = { ...children, [entry.path]: entries };
  };

  const open = (entry: ProjectEntry) => {
    if (!projectKey) return;
    if (insideArchive(entry.path)) {
      openFilePreview({
        url: projectArchiveFileUrl(projectKey, archiveOf(entry.path), innerOf(entry.path)),
        name: entry.name,
        onDelete: null,
      });
      return;
    }
    openProjectFile(projectKey, entry.path, entry.status);
  };

  const activate = (entry: ProjectEntry) => {
    if (entry.isDir || opensArchive(entry)) void toggle(entry);
    else open(entry);
  };

  let menuPath = $state<string | null>(null);

  const entryActions = (entry: ProjectEntry): FileActionEntry[] => {
    const key = projectKey;
    if (!key) return [];
    if (insideArchive(entry.path)) return entry.isDir ? [] : [{ id: "view", run: () => open(entry) }];
    const absolute = projectFilePath(project?.path ?? null, entry.path);
    const located: FileActionEntry[] = [
      { id: "mention", run: () => mentionInChat(absolute) },
      { id: "copyPath", run: () => void copyText(absolute) },
    ];
    if (entry.isDir) return located;
    return [
      { id: "view", run: () => open(entry) },
      ...fileEntries(FILE_ACTIONS, { url: projectFileUrl(key, entry.path) }, entry.name),
      { id: "link", run: () => void sharedApi.link(absolute, key) },
      ...located,
    ];
  };

  const slot = $derived(`${backend.activeId ?? ""}|${projectKey ?? ""}`);
  const memoryOf = (view: string) => `project|${slot}|${activeRepo?.path ?? ""}|${view}`;

  let placed = "";
  let logged = "";
  let synced = "";

  const folderOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));

  const inRepo = (path: string, known: GitRepo[] | null) =>
    known === null ||
    path.includes(".git/") ||
    known.some((repo) => !repo.relative || path === repo.relative || path.startsWith(`${repo.relative}/`));

  const remember = () => {
    if (!compact || !placed) return;
    rememberProject(placed, {
      children,
      expanded,
      path: opened.path,
      changed,
      repos,
      repoRoot,
      tracked,
      locked,
    });
  };

  $effect(() => () => untrack(remember));

  $effect(() => {
    const target = slot;
    if (!projectKey || target === placed) return;
    untrack(() => {
      remember();
      placed = target;
      results = null;
      picked = {};
      const saved = compact ? recallProject(target) : undefined;
      children = saved?.children ?? {};
      expanded = saved?.expanded ?? {};
      changed = saved?.changed ?? null;
      repos = saved?.repos ?? null;
      repoRoot = saved?.repoRoot ?? null;
      tracked = saved?.tracked ?? false;
      locked = saved?.locked ?? false;
      if (saved?.path) opened.path = saved.path;
      else closeFile();
    });
  });

  $effect(() => {
    const key = projectKey;
    const environment = backend.activeId;
    const burst = watch.burst;
    const known = untrack(() => Object.keys(children)).filter((path) => !insideArchive(path) && !isArchive(path));
    if (!key) {
      loading = false;
      return;
    }
    const listed = known.length ? known : [""];
    const targets =
      burst.truncated || !known.length
        ? listed
        : listed.filter((path) => burst.paths.some((changed) => folderOf(changed) === path));
    if (!targets.length) return;
    loading = !known.length;
    const run = ++listingRun;
    for (const path of targets) listingRuns[path] = run;
    void Promise.all(
      targets.map((path) => projectFilesApi.tree(key, path).then((listing) => [path, listing] as const)),
    ).then((arrived) => {
      if (projectKey !== key || backend.activeId !== environment) return;
      loading = false;
      const loaded = arrived.filter(([path]) => listingRuns[path] === run);
      const root = loaded.find(([path]) => path === "")?.[1];
      const updates = loaded
        .filter(([, listing]) => listing)
        .map(([path, listing]) => [path, keepUnchanged(children[path], listing!.entries, (entry) => entry.path)] as const);
      if (updates.some(([path, entries]) => entries !== children[path])) {
        children = { ...children, ...Object.fromEntries(updates) };
      }
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

  const openFolders = $derived(
    Object.keys(expanded)
      .filter((path) => expanded[path] && !path.includes(ARCHIVE_MARK))
      .sort(),
  );

  $effect(() => {
    if (projectKey) watch.watch(projectKey, openFolders);
  });

  $effect(() => {
    const burst = watch.burst;
    if (burst.truncated) projectDiffs.invalidate(null);
    else if (burst.paths.length) projectDiffs.invalidate(burst.paths);
  });

  $effect(() => {
    const key = projectKey;
    const burst = watch.burst;
    if (!showChanged) {
      changed = null;
      return;
    }
    if (!key) return;
    const known = untrack(() => repos);
    const target = untrack(() => slot);
    const current = changesSlot === target && untrack(() => changed) !== null;
    if (current && !burst.truncated && !burst.paths.some((path) => inRepo(path, known))) return;
    changesSlot = target;
    void projectFilesApi.changes(key).then((found) => {
      if (projectKey !== key || !showChanged) return;
      changed = found ?? [];
    });
  });

  $effect(() => {
    const key = projectKey;
    const listed = files;
    if (!key || !settings.projectDiff || !listed.length) return;
    void projectDiffs.prefetch(
      key,
      listed.filter((entry) => !entry.isDir).map((entry) => entry.path),
    );
  });

  $effect(() => {
    const key = projectKey;
    const target = activeRepo?.path ?? "";
    const burst = watch.burst;
    if (!showLog) {
      logged = "";
      commits = null;
      return;
    }
    if (!key || !target) return;
    const moved = burst.truncated || burst.paths.some((path) => path.includes(".git/"));
    if (logged === `${key}|${target}` && !moved) return;
    logged = `${key}|${target}`;
    logDone = false;
    void gitApi.log(key, target).then((found) => {
      if (projectKey !== key || activeRepo?.path !== target || !showLog) return;
      commits = found ?? [];
      logDone = found === null || found.length === 0;
    });
  });

  $effect(() => {
    const key = projectKey;
    const burst = watch.burst;
    const stamp = `${key}|${gitTick}`;
    if (!showChanged || gitMissing) {
      synced = "";
      repos = null;
      return;
    }
    if (!key) return;
    const moved = burst.truncated || burst.paths.some((path) => path.includes(".git/"));
    if (synced === stamp && !moved) return;
    synced = stamp;
    void gitApi.repos(key).then((found) => {
      if (projectKey === key && showChanged) repos = found ?? [];
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
      active={searching}
      onclick={() => {
        searching = !searching;
        if (!searching) query = "";
      }}
    >
      <Search />
    </TooltipIconButton>
  {/if}
  {#if locked}
    <TooltipIconButton
      label={t("UNLOCK")}
      onclick={() => {
        rejected = false;
        unlocking = true;
      }}
    >
      <Lock />
    </TooltipIconButton>
  {/if}
  {#if projectKey && showChanged && activeRepo}
    <TooltipIconButton
      label={t("GIT_HISTORY")}
      active={showLog}
      onclick={() => (showLog = !showLog)}
    >
      <History />
    </TooltipIconButton>
  {/if}
{/snippet}

{#snippet viewBar()}
  <div class={tail ? PANE_TOP_CLASS : "flex shrink-0 items-center gap-1 px-(--page-inset) pb-2"}>
    {#if compact && (insideRepo || pinned)}
      <TooltipIconButton label={t("BACK")} onclick={stepUp}>
        <ArrowLeft />
      </TooltipIconButton>
    {/if}
    <SegmentedButtons
      options={[t("FILES"), t("DIFF")]}
      selected={showChanged ? 1 : 0}
      counts={[null, changeCount]}
      onSelect={pickView}
    />
    <div class="min-w-0 flex-1"></div>
    <div class="flex shrink-0 items-center">
      {#if compact}
        {#if selectable}
          {@render selectAllAction()}
        {/if}
        {@render headerActions()}
      {/if}
      {@render tail?.()}
    </div>
  </div>
{/snippet}

{#snippet commitRow(commit: GitCommit, index: number, last: boolean)}
  {@const local = index < unpushed}
  {@const head = index === 0}
  {@const rail = local ? "bg-green" : "bg-accent"}
  {@const dot = local ? "fill-green" : "fill-accent"}
  {@const ring = local ? "stroke-green" : "stroke-accent"}
  <div class="relative py-1.5 pr-2.5" style="padding-left: {RAIL_X + RAIL_GAP}px">
    <span
      style="left: {RAIL_X}px; top: {head ? `calc(50% + ${HEAD_SIZE / HALF}px)` : '0px'}; bottom: {last
        ? '50%'
        : '0px'}"
      class="absolute w-0.5 -translate-x-1/2 {rail}"
    ></span>
    {#if head}
      <svg
        style="left: {RAIL_X}px; width: {HEAD_SIZE}px; height: {HEAD_SIZE}px"
        viewBox="0 0 {DOT_BOX} {DOT_BOX}"
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <circle
          cx={DOT_BOX / HALF}
          cy={DOT_BOX / HALF}
          r={(DOT_BOX - RING_STROKE * 1.5) / HALF}
          fill="none"
          stroke-width={RING_STROKE}
          class={ring}
        />
        <circle cx={DOT_BOX / HALF} cy={DOT_BOX / HALF} r={DOT_BOX / 4} class={dot} />
      </svg>
    {:else}
      <svg
        style="left: {RAIL_X}px; width: {DOT_SIZE}px; height: {DOT_SIZE}px"
        viewBox="0 0 {DOT_BOX} {DOT_BOX}"
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <circle cx={DOT_BOX / HALF} cy={DOT_BOX / HALF} r={DOT_BOX / HALF} class={dot} />
      </svg>
    {/if}
    <span class="block truncate text-body-md">{commit.subject}</span>
    <span class="block truncate text-body-sm text-on-surface-variant">
      {joined(commit.hash, commit.author, formatDateShort(commit.date * MILLIS_PER_SECOND))}
    </span>
  </div>
{/snippet}

{#snippet projectRow(item: ProjectInfo)}
  <Pressable onclick={() => panelProject.pin(item.projectKey)} class={ROW_CLASS}>
    <FolderClosed size={16} class="shrink-0 text-on-surface-variant" />
    <span class="min-w-0 flex-1 truncate text-body-md">{projectLabel(item)}</span>
  </Pressable>
{/snippet}

{#snippet repoRow(item: GitRepo)}
  {@const count = repoCounts[item.path] ?? 0}
  {@const Icon = projectIcon(item.path, true, true)}
  <Pressable onclick={() => enterRepo(item)} class={ROW_CLASS}>
    <Icon size={16} class="shrink-0 text-on-surface-variant" />
    <span class="min-w-0 flex-1 truncate text-body-md">{item.name}</span>
    <span class="flex min-w-0 items-center gap-2 text-caption text-on-surface-variant">
      {#if item.behind}
        <span class="flex shrink-0 items-center"><ArrowDown size={12} />{item.behind}</span>
      {/if}
      {#if item.ahead}
        <span class="flex shrink-0 items-center text-accent"><ArrowUp size={12} />{item.ahead}</span>
      {/if}
      <span class="truncate">{item.branch || t("GIT_DETACHED")}</span>
      {#if count}
        <span class="shrink-0 text-accent">{count}</span>
      {/if}
    </span>
  </Pressable>
{/snippet}

{#snippet nameWithFolder(entry: ProjectEntry, folder: string, tone: string)}
  <span class="min-w-0 flex-1 truncate text-body-md {tone}">
    {entry.name}{#if folder}<span class="ml-2 text-caption text-faint">{folder}</span>{/if}
  </span>
{/snippet}

{#snippet pathRow(entry: ProjectEntry)}
  {@const Icon = fileIcon(entry.path)}
  {@const current = entry.path === opened.path}
  <Pressable
    onclick={() => !entry.status.includes("D") && open(entry)}
    hover={!current}
    class="{ROW_CLASS} {current ? 'bg-surface-variant' : ''}"
  >
    <Icon size={16} class="shrink-0 text-on-surface-variant" />
    {@render nameWithFolder(entry, folderOf(entry.path), entryClass(entry))}
  </Pressable>
{/snippet}

{#snippet selectAllAction()}
  {@const allChosen = files.length > 0 && chosen.length === files.length}
  <TooltipIconButton
    label={t(allChosen ? "DESELECT_ALL" : "SELECT_ALL")}
    shortcut="project.selectAll"
    onclick={selectAll}
  >
    <SelectionDot selected={allChosen} size={compact ? 16 : 18} />
  </TooltipIconButton>
{/snippet}

{#snippet changedRow(entry: ProjectEntry, depth: number, unfolded: boolean)}
  {@const counts = entry.isDir ? null : countsOf(entry)}
  {@const current = !entry.isDir && entry.path === opened.path}
  <div
    data-press
    class="flex h-8 w-full items-center rounded-md transition-colors {current ? 'bg-surface-variant' : 'hover:bg-hover'}"
    oncontextmenu={(event) => {
      event.preventDefault();
      if (!locked) settings.projectCommitOpen = true;
      togglePick(entry);
    }}
    role="presentation"
  >
    {#if committing}
      <button
        type="button"
        onclick={() => togglePick(entry)}
        aria-label={entry.name}
        class="flex h-full shrink-0 cursor-pointer items-center pl-2.5"
      >
        <SelectionDot selected={marked(entry)} size={16} />
      </button>
    {/if}
    <Pressable
      onclick={() => (entry.isDir ? fold(entry.path) : open(entry))}
      hover={false}
      class="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-left"
    >
      {@render rowLabel(entry, depth, unfolded)}
      {#if counts}
        <span class="flex shrink-0 items-center gap-2 text-caption">
          {#if counts.added}<span class="text-green">+{counts.added}</span>{/if}
          {#if counts.removed}<span class="text-red">-{counts.removed}</span>{/if}
        </span>
      {/if}
    </Pressable>
  </div>
{/snippet}

{#snippet rowLabel(entry: ProjectEntry, depth: number, open: boolean)}
  {@const Icon = projectIcon(entry.path, entry.isDir, entry.repo)}
  <span style="margin-left: {depth * INDENT}px" class="flex size-4 shrink-0 items-center justify-center">
    {#if entry.isDir || opensArchive(entry)}
      <ChevronRight size={14} class="text-on-surface-variant {open ? 'rotate-90' : ''}" />
    {/if}
  </span>
  <Icon size={16} class="shrink-0 text-on-surface-variant" />
  <span class="min-w-0 flex-1 truncate text-body-md {entryClass(entry)}">{entry.name}</span>
{/snippet}

{#snippet fileRow(entry: ProjectEntry, depth: number, open: boolean, action: () => void)}
  {@const current = !entry.isDir && entry.path === opened.path}
  {@const menued = menuPath === entry.path}
  {@const holdMenu = () => (menuPath = entry.path)}
  <div
    data-press
    class="group flex h-8 w-full items-center rounded-md transition-colors {current || menued
      ? 'bg-surface-variant'
      : 'hover:bg-hover'}"
  >
    <Pressable
      onclick={action}
      onlongclick={holdMenu}
      oncontextmenu={holdMenu}
      hover={false}
      class="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-left"
    >
      {@render rowLabel(entry, depth, open)}
    </Pressable>
    <div class="shrink-0 pr-1">
      <RowMenu open={menued} onOpenChange={(value) => (menuPath = value ? entry.path : null)} shown={current}>
        <FileActionItems actions={entryActions(entry)} />
      </RowMenu>
    </div>
  </div>
{/snippet}

<div
  class="relative flex h-full min-h-0 flex-col"
  onpointerdowncapture={() => paneFocus.set("project")}
>
  {#if !compact}
    <AppTopBar
      title={t("PROJECT_FILES")}
      subtitle={(insideRepo && activeRepo ? activeRepo.name : project?.name) ?? null}
    >
      {#snippet navigationIcon()}
        <div class="flex shrink-0 items-center">
          <TooltipIconButton label={t("BACK")} onclick={() => stepUp() || navigation.back()}>
            <ArrowLeft size={20} />
          </TooltipIconButton>
          {#if selectable}
            {@render selectAllAction()}
          {/if}
        </div>
      {/snippet}
      {#snippet actions()}
        {@render headerActions()}
      {/snippet}
    </AppTopBar>
  {/if}

  {#if projectKey}
    {@render viewBar()}
  {/if}

  {#if projects.length}
    <div class="shrink-0 px-(--page-inset) pb-2">
      <ProjectSelector
        {projects}
        selected={pinned || null}
        shown={project ? projectLabel(project) : (projectKey ?? t("ALL_PROJECTS"))}
        following={pinned === null}
        onFollow={() => panelProject.pin(null)}
        onSelect={(key) => panelProject.pin(key ?? "")}
      />
    </div>
  {/if}

  <div class="flex min-h-0 flex-1 flex-col gap-2 px-(--page-inset)">
    {#if searching}
      <SearchBar
        value={query}
        oninput={(value) => (query = value)}
        placeholder={t("SEARCH")}
        autofocus
        large={!compact}
        class="shrink-0"
        onClose={() => {
          searching = false;
          query = "";
        }}
      />
    {/if}

    {#if serverStatus.unavailable}
      <ServerUnavailable class="min-h-0 flex-1" />
    {:else if loading || (!projectKey && list?.loading !== false)}
      <CenteredProgress class="min-h-0 flex-1" />
    {:else if !projectKey}
      {#if projects.length}
        <ScrollCard frame={LIST_FRAME} memory={memoryOf("projects")}>
          {#each projects as item (item.projectKey)}
            {@render projectRow(item)}
          {/each}
        </ScrollCard>
      {:else}
        <EmptyState icon={FolderClosed} text={t("NO_PROJECTS")} class="min-h-0 flex-1" />
      {/if}
    {:else if showChanged && gitMissing}
      <EmptyState icon={FolderGit2} text={t("GIT_MISSING")} class="min-h-0 flex-1" />
    {:else if showChanged && repos === null}
      <CenteredProgress class="min-h-0 flex-1" />
    {:else if showChanged && !activeRepo}
      {#if repoRows.length}
        <ScrollCard frame={LIST_FRAME} memory={memoryOf("repos")}>
          {#each repoRows as item (item.path)}
            {@render repoRow(item)}
          {/each}
        </ScrollCard>
      {:else}
        <EmptyState icon={FolderGit2} text={t("NOT_A_REPOSITORY")} class="min-h-0 flex-1" />
      {/if}
    {:else if showLog}
      {#if commits === null}
        <CenteredProgress class="min-h-0 flex-1" />
      {:else if commits.length}
        <ScrollCard frame={LIST_FRAME} memory={memoryOf("log")} onscroll={onListScroll}>
          {#each commits as commit, index (commit.hash)}
            {@render commitRow(commit, index, index === commits.length - 1)}
          {/each}
        </ScrollCard>
      {:else}
        <EmptyState icon={History} text={t("GIT_NO_COMMITS")} class="min-h-0 flex-1" />
      {/if}
    {:else if showChanged && changed === null}
      <CenteredProgress class="min-h-0 flex-1" />
    {:else if showChanged}
      {#if files.length}
        <ScrollCard frame={LIST_FRAME} memory={memoryOf("changed")}>
          <div use:changedWindow.track style={changedWindow.style}>
            {#each changedWindow.slice(changedRows) as row (row.entry.path)}
              {@render changedRow(row.entry, row.depth, expanded[row.entry.path] === true)}
            {/each}
          </div>
        </ScrollCard>
      {:else}
        <EmptyState icon={GitCompare} text={t("NO_CHANGES")} class="min-h-0 flex-1" />
      {/if}
    {:else if results !== null}
      {#if results.length}
        <ScrollCard frame={LIST_FRAME}>
          <div use:resultsWindow.track style={resultsWindow.style}>
            {#each resultsWindow.slice(results) as entry (entry.path)}
              {@render pathRow(entry)}
            {/each}
          </div>
        </ScrollCard>
      {:else}
        <EmptyState icon={NO_RESULTS_ICON} text={t("NO_RESULTS")} class="min-h-0 flex-1" />
      {/if}
    {:else if rows.length}
      <ScrollCard frame={LIST_FRAME} memory={memoryOf("tree")}>
        <div use:treeWindow.track style={treeWindow.style}>
          {#each treeWindow.slice(rows) as row (row.entry.path)}
            {@render fileRow(row.entry, row.depth, expanded[row.entry.path] === true, () =>
              activate(row.entry),
            )}
          {/each}
        </div>
      </ScrollCard>
    {:else}
      <EmptyState icon={FolderClosed} text={t("NO_FILES")} class="min-h-0 flex-1" />
    {/if}
  </div>

  <div class={BAR_REGION_CLASS}>
    {#if showChanged && activeRepo && projectKey}
      <div class={BAR_DOCK_CLASS}>
        <CommitBar
          {projectKey}
          repo={activeRepo}
          paths={commitPaths}
          {locked}
          {instant}
          onDone={() => {
            gitTick++;
            watch.refresh();
          }}
        />
      </div>
    {/if}
  </div>

  {#if showingFile && opened.path !== null && projectKey}
    <div class={fullFile ? "" : "absolute inset-0 z-10"}>
      <ProjectDiffView
        {projectKey}
        path={opened.path}
        status={opened.status}
        root={project?.path ?? null}
        embedded={compact && !fullFile}
        onExpand={expandable && !fullFile ? () => (opened.full = true) : null}
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
