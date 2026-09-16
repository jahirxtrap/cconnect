<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FolderClosed from "@lucide/svelte/icons/folder-closed";
  import GitCompare from "@lucide/svelte/icons/git-compare";
  import History from "@lucide/svelte/icons/history";
  import Lock from "@lucide/svelte/icons/lock";
  import Search from "@lucide/svelte/icons/search";
  import { untrack } from "svelte";
  import { activeScope } from "$lib/app/activeScope.svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { isEditing, paneFocus } from "$lib/data/paneFocus.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { paneActionClass } from "$lib/screens/chat/paneChrome";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { projectLabel, type ProjectInfo } from "$lib/data/models";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { formatDateShort } from "$lib/data/time";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import { backend } from "$lib/services/backend.svelte";
  import { projectFilesApi, type ProjectEntry } from "$lib/services/projectFilesApi";
  import { gitApi, type GitCommit, type GitRepo } from "$lib/services/gitApi";
  import { ProjectWatch } from "$lib/services/projectWatch.svelte";
  import { recallProject, rememberProject } from "./projectMemory";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { fileIcon, projectIcon } from "$lib/ui/fileIcons";
  import { nearEdge } from "$lib/ui/paging";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import SelectionDot from "$lib/ui/SelectionDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import CommitBar from "./CommitBar.svelte";
  import ProjectDiffView from "./ProjectDiffView.svelte";
  import { closeProjectFile, opened, openProjectFile } from "./openFile.svelte";
  import { projectDiffs } from "./projectDiffs.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import ProjectSelector from "$lib/screens/chat/ProjectSelector.svelte";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import { tabs } from "$lib/screens/chat/tabs.svelte";

  interface Props {
    instant?: boolean;
    elsewhere?: boolean;
  }

  const { instant = false, elsewhere = false }: Props = $props();

  const INDENT = 14;
  const BASE_INDENT = 8;
  const SEARCH_DELAY_MS = 200;
  const MILLIS_PER_SECOND = 1000;
  const RAIL_X = 20;
  const RAIL_GAP = 12;
  const HEAD_SIZE = 16;
  const DOT_SIZE = 9;
  const HALF = 2;

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
  let showChanged = $state(settings.projectChangedOnly);
  let changed = $state<ProjectEntry[] | null>(null);
  let showLog = $state(false);
  let commits = $state<GitCommit[] | null>(null);
  let logDone = $state(false);
  let logPaging = $state(false);
  let repos = $state<GitRepo[] | null>(null);
  let repoRoot = $state<string | null>(null);
  let gitTick = $state(0);
  let picked = $state<Record<string, boolean>>({});

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
        first.name.localeCompare(second.name),
    ),
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
    tabs.setPanelProject("");
    return true;
  };

  const stepUp = () => {
    if (showingFile) {
      closeFile();
      return true;
    }
    return leaveRepo() || leaveProject();
  };

  const stepBack = () => (isTouch ? cancelMode() || stepUp() : stepUp() || cancelMode());

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !engaged || isEditing()) return;
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

  const marked = (entry: ProjectEntry) =>
    entry.isDir
      ? files.some((item) => inFolder(entry, item) && picked[item.path] === true)
      : picked[entry.path] === true;
  let unlocking = $state(false);
  let rejected = $state(false);
  let loading = $state(false);

  const followed = $derived(chat.historyProject);
  const pinned = $derived(tabs.active?.panelProject ?? null);
  const projectKey = $derived(settings.lockedProject || (pinned === null ? followed : pinned || null));

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

  const open = (entry: ProjectEntry) => {
    if (projectKey) openProjectFile(projectKey, entry.path, entry.status);
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
  let logged = "";
  let synced = "";

  const folderOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));

  $effect(() => {
    const target = slot;
    if (!projectKey || target === placed) return;
    untrack(() => {
      if (compact && placed) {
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
      }
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
    const known = untrack(() => Object.keys(children));
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
    void Promise.all(
      targets.map((path) => projectFilesApi.tree(key, path).then((listing) => [path, listing] as const)),
    ).then((loaded) => {
      if (projectKey !== key || backend.activeId !== environment) return;
      loading = false;
      const root = loaded.find(([path]) => path === "")?.[1];
      children = {
        ...children,
        ...Object.fromEntries(
          loaded.filter(([, listing]) => listing).map(([path, listing]) => [path, listing!.entries]),
        ),
      };
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
    if (!burst.truncated && !burst.paths.length && untrack(() => changed) !== null) return;
    void projectFilesApi.changes(key).then((found) => {
      if (projectKey !== key || !showChanged) return;
      changed = found;
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
      commits = found;
      logDone = found !== null && found.length === 0;
    });
  });

  $effect(() => {
    const key = projectKey;
    const burst = watch.burst;
    const stamp = `${key}|${gitTick}`;
    if (!showChanged) {
      synced = "";
      repos = null;
      return;
    }
    if (!key) return;
    const moved = burst.truncated || burst.paths.some((path) => path.includes(".git/"));
    if (synced === stamp && !moved) return;
    synced = stamp;
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
  {#if projectKey && showChanged && activeRepo}
    <TooltipIconButton
      label={t("GIT_HISTORY")}
      class={paneActionClass(compact)}
      onclick={() => (showLog = !showLog)}
    >
      <History class={showLog ? "text-accent" : ""} />
    </TooltipIconButton>
  {/if}
  {#if projectKey}
    <TooltipIconButton
      label={t("CHANGED_FILES")}
      class={paneActionClass(compact)}
      shortcut="project.changes"
      onclick={toggleChanges}
    >
      <GitCompare class={showChanged && !showLog ? "text-accent" : ""} />
    </TooltipIconButton>
  {/if}
{/snippet}

{#snippet commitRow(commit: GitCommit, index: number, last: boolean)}
  {@const local = index < unpushed}
  {@const head = index === 0}
  {@const dot = local ? "bg-green" : "bg-accent"}
  {@const ring = local ? "border-green" : "border-accent"}
  <div class="relative py-1.5 pr-4" style="padding-left: {RAIL_X + RAIL_GAP}px">
    <span
      style="left: {RAIL_X}px; top: {head ? `calc(50% + ${HEAD_SIZE / HALF}px)` : '0px'}; bottom: {last
        ? '50%'
        : '0px'}"
      class="absolute w-0.5 -translate-x-1/2 {dot}"
    ></span>
    {#if head}
      <span
        style="left: {RAIL_X}px; width: {HEAD_SIZE}px; height: {HEAD_SIZE}px"
        class="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 {ring}"
      >
        <span style="width: {DOT_SIZE}px; height: {DOT_SIZE}px" class="rounded-full {dot}"></span>
      </span>
    {:else}
      <span
        style="left: {RAIL_X}px; width: {DOT_SIZE}px; height: {DOT_SIZE}px"
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full {dot}"
      ></span>
    {/if}
    <span class="block truncate text-body-md">{commit.subject}</span>
    <span class="block truncate text-body-sm text-on-surface-variant">
      {commit.hash} • {commit.author} • {formatDateShort(commit.date * MILLIS_PER_SECOND)}
    </span>
  </div>
{/snippet}

{#snippet projectRow(item: ProjectInfo)}
  <Pressable
    onclick={() => tabs.setPanelProject(item.projectKey)}
    class="flex w-full items-center gap-2 px-4 py-1.5 text-left"
  >
    <FolderClosed size={16} class="shrink-0 text-on-surface-variant" />
    <span class="min-w-0 flex-1 truncate text-body-md">{projectLabel(item)}</span>
  </Pressable>
{/snippet}

{#snippet repoRow(item: GitRepo)}
  {@const count = repoCounts[item.path] ?? 0}
  {@const Icon = projectIcon(item.path, true, true)}
  <Pressable onclick={() => enterRepo(item)} class="flex w-full items-center gap-1.5 px-4 py-1.5 text-left">
    <Icon size={16} class="shrink-0 text-on-surface-variant" />
    <span class="min-w-0 flex-1 truncate text-body-md">{item.name}</span>
    {#if item.behind}
      <span class="flex shrink-0 items-center text-label-md text-on-surface-variant">
        <ArrowDown size={13} />{item.behind}
      </span>
    {/if}
    {#if item.ahead}
      <span class="flex shrink-0 items-center text-label-md text-accent"><ArrowUp size={13} />{item.ahead}</span>
    {/if}
    <span class="shrink-0 truncate text-label-md text-on-surface-variant">
      {item.branch || t("GIT_DETACHED")}
    </span>
    {#if count}
      <span class="shrink-0 text-label-md text-accent">{count}</span>
    {/if}
  </Pressable>
{/snippet}

{#snippet pathRow(entry: ProjectEntry)}
  <Pressable
    onclick={() => !entry.status.includes("D") && open(entry)}
    class="flex w-full items-center gap-2 px-4 py-1.5 text-left"
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
      title={insideRepo && activeRepo ? activeRepo.name : t("PROJECT_FILES")}
      leading={selectable ? selectAllAction : undefined}
      onBack={insideRepo || pinned ? stepUp : undefined}
      actions={headerActions}
    />
  {:else}
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

  {#if projects.length}
    <div class="px-2 pt-2">
      <ProjectSelector
        {projects}
        selected={pinned || null}
        shown={project ? projectLabel(project) : (projectKey ?? t("ALL_PROJECTS"))}
        following={pinned === null}
        onFollow={() => tabs.setPanelProject(null)}
        onSelect={(key) => tabs.setPanelProject(key ?? "")}
      />
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

  <div class="min-h-0 flex-1 overflow-y-auto pb-2" onscroll={onListScroll}>
    {#if loading}
      <CenteredProgress class="h-full" />
    {:else if !projectKey}
      {#if serverStatus.unavailable}
        <EmptyState text={t("SERVER_UNAVAILABLE")} class="h-full" />
      {:else}
        {#each projects as item (item.projectKey)}
          {@render projectRow(item)}
        {:else}
          <EmptyState text={t("NO_PROJECTS")} class="h-full" />
        {/each}
      {/if}
    {:else if showChanged && repos === null}
      <CenteredProgress class="h-full" />
    {:else if showChanged && !activeRepo}
      {#each repoRows as item (item.path)}
        {@render repoRow(item)}
      {:else}
        <EmptyState text={t("NOT_A_REPOSITORY")} class="h-full" />
      {/each}
    {:else if showLog}
      {#if commits === null}
        <CenteredProgress class="h-full" />
      {:else}
        {#each commits as commit, index (commit.hash)}
          {@render commitRow(commit, index, index === commits.length - 1)}
        {:else}
          <EmptyState text={t("GIT_NO_COMMITS")} class="h-full" />
        {/each}
      {/if}
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

  {#if showChanged && activeRepo && projectKey}
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
  {/if}

  {#if opened.path !== null && projectKey && !elsewhere}
    <div class={opened.full ? "" : "absolute inset-0 z-10"}>
      <ProjectDiffView
        {projectKey}
        path={opened.path}
        status={opened.status}
        root={project?.path ?? null}
        embedded={compact && !opened.full}
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
