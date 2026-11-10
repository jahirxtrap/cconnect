<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowDownUp from "@lucide/svelte/icons/arrow-down-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import { copyText } from "$lib/platform/clipboard";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Filter from "@lucide/svelte/icons/filter";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import PackageOpen from "@lucide/svelte/icons/package-open";
  import Upload from "@lucide/svelte/icons/upload";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { slide } from "svelte/transition";
  import { dismissOpen } from "$lib/app/dismissStack";
  import { openFilePreview } from "$lib/app/filePreview";
  import { navigation } from "$lib/app/navigation.svelte";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { projectNameOf } from "$lib/data/models";
  import { compareNames, compareText, formatSize, isArchive, visibleName } from "$lib/data/format";
  import {
    FILE_KINDS,
    fileKindOf,
    isPreviewable,
    type FileKind,
  } from "$lib/data/previewKind";
  import { settings } from "$lib/data/settings.svelte";
  import { formatDateShort, MILLIS_PER_SECOND } from "$lib/data/time";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { transfers } from "$lib/data/transfers.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { COMPACT_WIDTH, layout } from "$lib/platform/layout.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import {
    archiveFileUrl,
    downloadUrl,
    sharedApi,
    type ClashPolicy,
    type SharedEntry,
  } from "$lib/services/sharedApi";
  import {
    downloadShared,
    openSharedExternally,
    saveSharedItemsAs,
    shareAllShared,
    shareShared,
  } from "$lib/services/sharedFiles";
  import { SharedWatch } from "$lib/services/sharedWatch.svelte";
  import { UPLOAD_DIR } from "$lib/services/uploadApi";
  import { dragTransfer, type SharedFile } from "$lib/app/dragPayload.svelte";
  import { activeScope } from "$lib/app/activeScope.svelte";
  import { isPackFile } from "$lib/design/packs/schema";
  import EnvironmentAction from "$lib/screens/chat/EnvironmentAction.svelte";
  import { offerShared } from "$lib/screens/packs/packIntake";
  import { compactPane, paneRole } from "$lib/screens/chat/paneSurface";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ClashDialog from "$lib/ui/ClashDialog.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DialogActionItem from "$lib/ui/DialogActionItem.svelte";
  import DropOverlay from "$lib/ui/DropOverlay.svelte";
  import { fileDrop } from "$lib/ui/fileDrop";
  import { entryIcon, kindIcon, kindLabel } from "$lib/ui/fileIcons";
  import EmptyState, { NO_RESULTS_ICON } from "$lib/ui/EmptyState.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import { MENU_ICON_SIZE, TOOLTIP_CLASS } from "$lib/ui/menuSurface";
  import { PREFERENCE_ICON_SIZE, PREFERENCE_ROW_CLASS, PREFERENCE_TRAILING_CLASS } from "$lib/ui/preferenceRow";
  import RowMenuTrigger from "$lib/ui/RowMenuTrigger.svelte";
  import { RowWindow } from "$lib/ui/rowWindow.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import { rememberScroll } from "$lib/ui/scrollMemory";
  import { joinedCorners } from "$lib/ui/joinedCorners";
  import SearchBar, { HEADER_SEARCH_CLASS } from "$lib/ui/SearchBar.svelte";
  import SelectionDot from "$lib/ui/SelectionDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import FileActionItems from "$lib/ui/FileActionItems.svelte";
  import { FILE_ACTION_LOOK, type FileActionEntry, type FileActionId } from "$lib/ui/sharedFileActions";
  import { BAR_ACTION_CLASS, BAR_CARD_CLASS, BAR_DOCK_CLASS, BAR_LABEL_CLASS, BAR_REGION_CLASS } from "$lib/ui/actionBar";
  import PathBar from "./PathBar.svelte";
  import CompressDialog from "./CompressDialog.svelte";
  import { recallShared, rememberShared } from "./sharedMemory";
  import { readSharedLocation, syncSharedLocation } from "./sharedUrl";
  import ToolbarAction from "./ToolbarAction.svelte";
  import { pastedName } from "$lib/data/pastedFile";
  import { isEditing } from "$lib/data/paneFocus.svelte";
  import { isTouch } from "$lib/platform";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { LONG_PRESS_MS, TOUCH_SLOP } from "$lib/ui/press";

  type SortKey = "name" | "date" | "type" | "size";
  type TransferKind = "move" | "copy" | "extract";

  interface TransferOp {
    kind: TransferKind;
    paths: string[];
    sourceDir: string;
    folders: string[];
    members?: string[] | null;
    base?: string;
  }

  interface ExtractRequest {
    archive: string;
    members: string[] | null;
    base: string;
    stem: string;
  }

  const role = paneRole();
  const compact = role !== null;

  let width = $state(0);

  const narrow = $derived(width < COMPACT_WIDTH);

  const SEARCH_DELAY_MS = 300;
  const SLIDE_MS = 150;
  const HEAD_SELECT_CLASS = "size-4 [&_svg]:size-4";
  const BAR_SHORTCUTS: Partial<Record<FileActionId, string>> = {
    move: "shared.cut",
    copy: "shared.copy",
    delete: "shared.delete",
  };
  const TONE_JOINING =
    "[transition:background-color_var(--default-transition-duration)_var(--default-transition-timing-function),border-radius_0s]";
  const TONE_PARTING =
    "[transition:background-color_var(--default-transition-duration)_var(--default-transition-timing-function),border-radius_0s_var(--default-transition-duration)]";
  const EDGE_ZONE = 96;
  const EDGE_STEP = 24;
  const WIDE_WIDTH = 800;
  const SORT_KEYS: SortKey[] = ["name", "date", "type", "size"];
  const SIZE_COLUMN = "w-24 shrink-0 justify-end text-right";
  const DATE_COLUMN = "w-36 shrink-0";
  const SORT_LABELS: Record<SortKey, string> = {
    name: "SORT_NAME",
    date: "SORT_DATE",
    type: "SORT_TYPE",
    size: "SORT_SIZE",
  };
  const ARCHIVE_SUFFIXES = [
    ".tar.gz",
    ".tar.bz2",
    ".tar.xz",
    ".zip",
    ".7z",
    ".rar",
    ".tar",
    ".tgz",
    ".tbz2",
    ".txz",
  ];

  const watcher = new SharedWatch();
  const initial = compact ? null : readSharedLocation();

  const home = $derived(tabs.state.historyProject || "");

  let path = $state(initial?.path || tabs.state.historyProject || "");
  let archive = $state<string | null>(initial?.archive ?? null);
  let archiveDir = $state(initial?.archiveDir ?? "");
  let entries = $state.raw<SharedEntry[]>([]);
  let loaded = $state(false);
  let selecting = $state(false);
  let selected = $state<string[]>([]);
  let transfer = $state<TransferOp | null>(null);
  let searching = $state(false);
  let searchQuery = $state("");
  let searchResults = $state.raw<SharedEntry[] | null>(null);
  let sortField = $state<SortKey>(settings.sharedSortField as SortKey);
  let sortAscending = $state(settings.sharedSortAscending);
  let hiddenKinds = $state(new Set(settings.sharedHiddenKinds));
  let clashing = $state<string[] | null>(null);
  let uploading = $state<File[] | null>(null);
  let deleting = $state<SharedEntry[] | null>(null);
  let renaming = $state<SharedEntry | null>(null);
  let creatingFolder = $state(false);
  let compressing = $state<SharedEntry[] | null>(null);
  let extractRequest = $state<ExtractRequest | null>(null);
  let barMenu = $state(false);
  let actionsMenu = $state(false);
  let rowMenu = $state<{ entry: SharedEntry; anchor: HTMLElement } | null>(null);
  let rowMenuOpen = $state(false);
  let bottomBar = $state(0);
  let pendingUploads = $state<File[]>([]);
  let picker = $state<HTMLInputElement | null>(null);
  let dropTarget = $state<string | null>(null);
  let dragging = $state<string[] | null>(null);
  let pendingFiles: SharedFile[] = [];
  let heldDrag = false;
  let touchGesture = false;
  let dragPoint = $state<{ x: number; y: number } | null>(null);
  let marking = $state(false);
  let list = $state<HTMLDivElement | null>(null);
  let seenUploads = new Set<number>();
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressOrigin: { x: number; y: number } | null = null;
  let pendingDrag: string[] | null = null;
  let captured: number | null = null;
  let swallowClick = false;
  let anchor = -1;
  let markBase: string[] = [];

  const wide = $derived(!compact && !layout.mobile && width >= WIDE_WIDTH);
  const iconSize = $derived(wide ? MENU_ICON_SIZE : PREFERENCE_ICON_SIZE);

  const child = (name: string) => (path ? `${path}/${name}` : name);

  const projects = $derived(chatListFor(backend.active)?.projects ?? []);
  const projectKeys = $derived(new Set(projects.map((item) => item.projectKey)));
  const hiddenKeys = $derived(
    new Set(
      (chatListFor(backend.active)?.projects ?? [])
        .filter((item) => settings.hiddenProjects.includes(item.projectKey))
        .map((item) => item.projectKey),
    ),
  );
  const ceiling = $derived(settings.lockedProject);

  const entryLabel = (path: string, name: string) =>
    projectKeys.has(path) ? projectNameOf(projects, path) : name;

  const pathLabel = (target: string) => entryLabel(target, target.split("/").pop() ?? "");

  const crumbPath = $derived(archive === null ? path : [archive, archiveDir].filter(Boolean).join("/"));
  const crumbLabel = $derived(ceiling ? projectNameOf(projects, ceiling) : null);

  $effect(() => {
    const locked = ceiling;
    if (!locked) return;
    untrack(() => {
      if (path !== locked && !path.startsWith(`${locked}/`)) path = locked;
    });
  });

  let followed = tabs.state.historyProject || "";

  $effect(() => {
    const next = home;
    if (next === followed) return;
    followed = next;
    if (ceiling) return;
    untrack(() => {
      path = next;
      archive = null;
      archiveDir = "";
      searching = false;
      searchQuery = "";
      exitSelection();
    });
  });
  $effect(() => {
    const target = navigation.sharedTarget;
    if (!target || compact) return;
    navigation.sharedTarget = null;
    untrack(() => {
      const name = target.split("/").pop() ?? "";
      const opening = isArchive(visibleName(name));
      path = target.split("/").slice(0, -1).join("/");
      archive = opening ? target : null;
      archiveDir = "";
      searching = false;
      searchQuery = "";
      selecting = !opening;
      selected = opening ? [] : [name];
    });
  });

  const innerChild = (name: string) => (archiveDir ? `${archiveDir}/${name}` : name);

  const archiveStem = (name: string) => {
    const lower = name.toLowerCase();
    const suffix = [...ARCHIVE_SUFFIXES].sort((a, b) => b.length - a.length).find((item) => lower.endsWith(item));
    return suffix ? name.slice(0, -suffix.length) : name;
  };

  const extensionOf = (name: string) => {
    const index = name.lastIndexOf(".");
    return index <= 0 ? "" : name.slice(index + 1).toLowerCase();
  };

  const splitName = (name: string, isDir: boolean) => {
    const extension = isDir ? "" : extensionOf(name);
    return { base: extension ? name.slice(0, -(extension.length + 1)) : name, extension };
  };

  const archiveNameOf = (entry: SharedEntry) => {
    const label = pathLabel(child(entry.file));
    return entry.isDir ? label : splitName(archiveStem(label), false).base;
  };

  const ordered = $derived.by(() => {
    const all = searchResults ?? entries;
    const source = path || !hiddenKeys.size ? all : all.filter((entry) => !hiddenKeys.has(entry.name));
    const list = hiddenKinds.size
      ? source.filter((entry) => entry.isDir || !hiddenKinds.has(fileKindOf(entry.name)))
      : [...source];
    const direction = sortAscending ? 1 : -1;
    const compare = (a: SharedEntry, b: SharedEntry) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      if (sortField === "date") return direction * (a.modified - b.modified);
      if (sortField === "size") {
        return direction * ((a.isDir ? a.items : a.size) - (b.isDir ? b.items : b.size));
      }
      if (sortField === "type") {
        const byType = compareText(extensionOf(a.name), extensionOf(b.name));
        return direction * (byType || compareText(a.name.toLowerCase(), b.name.toLowerCase()));
      }
      return direction * compareNames(a.name, b.name);
    };
    return list.sort(compare);
  });

  const rowWindow = new RowWindow(() => ordered.length);

  const shownCount = $derived.by(() => {
    const total = (searchResults ?? entries).length;
    return ordered.length === total ? "" : `${ordered.length}/${total}`;
  });

  const selectedSet = $derived(new Set(selected));
  const selectedEntries = $derived(entries.filter((entry) => selectedSet.has(entry.file)));
  const allSelected = $derived(ordered.length > 0 && ordered.every((entry) => selectedSet.has(entry.file)));
  const transferAllowed = $derived(
    transfer !== null &&
      archive === null &&
      !transfer.folders.some((folder) => path === folder || path.startsWith(`${folder}/`)) &&
      (transfer.kind !== "move" || path !== transfer.sourceDir),
  );
  const selectionBar = $derived(selecting && (wide || selected.length > 0));
  const docked = $derived(transfer !== null || selectionBar);
  const rowMenus = $derived(transfer === null && !isTouch && !(role !== null && compactPane(role, false)));
  const querying = $derived(searching && searchQuery.trim().length > 0);

  const selectAll = () => {
    selecting = true;
    selected = allSelected ? [] : ordered.map((entry) => entry.file);
  };

  const exitSelection = () => {
    selecting = false;
    selected = [];
  };

  const reload = async () => {
    const current = archive;
    if (current === null) {
      watcher.refresh();
      return;
    }
    const inside = archiveDir;
    const members = (await sharedApi.archiveList(current, inside)) ?? [];
    if (archive !== current || archiveDir !== inside) return;
    entries = members;
    loaded = true;
  };

  const goUp = () => {
    if (archive !== null && archiveDir) archiveDir = archiveDir.split("/").slice(0, -1).join("/");
    else if (archive !== null) {
      archive = null;
      archiveDir = "";
    } else if (!path) navigation.navigate("/");
    else path = path.split("/").slice(0, -1).join("/");
  };

  const navigateTo = (target: string) => {
    const current = archive;
    if (current !== null && (target === current || target.startsWith(`${current}/`))) {
      archiveDir = target.slice(current.length).replace(/^\/+/, "");
    } else {
      archive = null;
      archiveDir = "";
      path = target;
    }
  };

  const toggleSearch = () => {
    searching = !searching;
    if (!searching) searchQuery = "";
  };

  const search = (value: string) => {
    searchQuery = value;
    searching = value.length > 0;
  };

  const toggle = (name: string) => {
    selected = selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name];
  };

  const contextSelect = (entry: SharedEntry) => {
    if (touchGesture || transfer) return;
    selecting = true;
    toggle(entry.file);
  };

  const openEntry = (entry: SharedEntry) => {
    if (selecting) {
      toggle(entry.file);
      return;
    }
    if (entry.isDir) {
      if (archive !== null) archiveDir = innerChild(entry.file);
      else {
        path = child(entry.file);
        searching = false;
        searchQuery = "";
      }
      return;
    }
    if (archive !== null) {
      if (isPreviewable(entry.name)) {
        openFilePreview({
          url: archiveFileUrl(archive, innerChild(entry.file)),
          name: entry.name,
          onDelete: null,
        });
      } else if (!transfer) {
        selecting = true;
        selected = [entry.file];
      }
      return;
    }
    if (entry.missing) {
      const relative = child(entry.file);
      openFilePreview({
        url: downloadUrl(relative),
        name: entry.name,
        kind: "text",
        onDelete: () => void sharedApi.remove(relative).then(reload),
      });
      return;
    }
    if (isPackFile(entry.name)) {
      offerShared(downloadUrl(child(entry.file)), entry.name);
      return;
    }
    if (isArchive(entry.name)) {
      archive = child(entry.file);
      archiveDir = "";
      searching = false;
      searchQuery = "";
      return;
    }
    if (isPreviewable(entry.name)) {
      const relative = child(entry.file);
      openFilePreview({
        url: downloadUrl(relative),
        name: entry.name,
        onDelete: () => void sharedApi.remove(relative).then(reload),
      });
      return;
    }
    if (!transfer) {
      selecting = true;
      selected = [entry.file];
    }
  };

  const finishWith = (items: SharedEntry[]) => {
    if (items.some((entry) => selectedSet.has(entry.file))) exitSelection();
  };

  const startTransfer = (kind: TransferKind, items: SharedEntry[] = selectedEntries) => {
    transfer = {
      kind,
      paths: items.map((entry) => child(entry.file)),
      sourceDir: path,
      folders: items.filter((entry) => entry.isDir).map((entry) => child(entry.file)),
    };
    exitSelection();
  };

  const runTransfer = async (policy: ClashPolicy | null = null) => {
    const op = transfer;
    if (!op) return;
    if (policy === null && op.kind !== "extract") {
      const names = await sharedApi.clashes(op.paths, path);
      if (names.length) {
        clashing = names;
        return;
      }
    }
    const chosen = policy ?? "keep";
    if (op.kind === "move") await sharedApi.move(op.paths, path, chosen);
    else if (op.kind === "copy") await sharedApi.copy(op.paths, path, chosen);
    else {
      await sharedApi.extract(op.paths[0], {
        dest: path,
        intoFolder: false,
        members: op.members,
        base: op.base,
      });
    }
    transfer = null;
    clashing = null;
    await reload();
  };

  const sourceOf = (entry: SharedEntry) => ({
    url: archive === null ? downloadUrl(child(entry.file)) : archiveFileUrl(archive, innerChild(entry.name)),
    name: entry.name,
  });

  const shareEntries = (items: SharedEntry[]) => {
    const files = items.map(sourceOf);
    if (files.length === 1) void shareShared(files[0].url, files[0].name);
    else void shareAllShared(files);
    finishWith(items);
  };

  const saveEntries = (items: SharedEntry[]) => {
    items.map(sourceOf).forEach((file) => void downloadShared(file.url, file.name));
    finishWith(items);
  };

  const saveEntriesAs = (items: SharedEntry[]) => {
    void saveSharedItemsAs(items.map(sourceOf));
    finishWith(items);
  };

  const attachEntries = (items: SharedEntry[]) => {
    const target = panes.focusedTab;
    if (target) tabs.stateFor(target).addSharedAttachments(filesOf(items));
    finishWith(items);
  };

  const copyPathsOf = (items: SharedEntry[]) => {
    void sharedApi
      .absolutePaths(items.map((entry) => child(entry.file)))
      .then((paths) => paths && copyText(paths.join("\n")));
    finishWith(items);
  };

  const bringHere = (entry: SharedEntry) => {
    void sharedApi.materialize(child(entry.file)).then(reload);
    finishWith([entry]);
  };

  const viewEntry = (entry: SharedEntry) => {
    const relative = child(entry.file);
    openFilePreview({
      url: sourceOf(entry).url,
      name: entry.name,
      onDelete: archive === null ? () => void sharedApi.remove(relative).then(reload) : null,
    });
    finishWith([entry]);
  };

  const openExternally = (entry: SharedEntry) => {
    const file = sourceOf(entry);
    void openSharedExternally(file.url, file.name);
    finishWith([entry]);
  };

  const extractArchive = (entry: SharedEntry) => {
    extractRequest = {
      archive: child(entry.file),
      members: null,
      base: "",
      stem: archiveStem(entry.name),
    };
  };

  const extractMembers = (items: SharedEntry[]) => {
    if (archive === null) return;
    extractRequest = {
      archive,
      members: items.map((entry) => innerChild(entry.name)),
      base: archiveDir,
      stem: archiveStem(visibleName(archive.split("/").pop() ?? archive)),
    };
  };

  const actionsFor = (items: SharedEntry[]): FileActionEntry[] => {
    const one = items.length === 1 ? items[0] : null;
    const file = one && !one.isDir ? one : null;
    const files = items.length > 0 && items.every((entry) => !entry.isDir);
    const actions: FileActionEntry[] = [];
    const offer = (id: FileActionId, run: () => unknown, when = true) => {
      if (when) actions.push({ id, run });
    };
    if (archive !== null) {
      offer("extract", () => extractMembers(items));
    } else {
      offer("bring", () => one && bringHere(one), !!one?.link && !one.missing);
      offer("extract", () => file && extractArchive(file), !!file && isArchive(file.name));
      offer("install", () => file && offerShared(downloadUrl(child(file.file)), file.name), !!file && isPackFile(file.name));
    }
    offer("view", () => file && viewEntry(file), !!file && isPreviewable(file.name));
    offer("external", () => file && openExternally(file), !!file);
    offer("save", () => saveEntries(items), files);
    offer("saveAs", () => saveEntriesAs(items), files);
    offer("share", () => shareEntries(items), files);
    if (archive !== null) return actions;
    offer("rename", () => (renaming = one), !!one);
    offer("move", () => startTransfer("move", items));
    offer("copy", () => startTransfer("copy", items));
    offer("compress", () => (compressing = items));
    offer("attach", () => attachEntries(items), filesOf(items).length > 0);
    offer("copyPath", () => copyPathsOf(items));
    offer("delete", () => (deleting = items));
    return actions;
  };

  const rowActions = (items: SharedEntry[]) => actionsFor(items).filter((action) => action.id !== "compress");

  const barIds = $derived<FileActionId[]>(archive === null ? ["move", "copy", "share", "delete"] : ["extract", "save", "share"]);

  const barMore = $derived(actionsFor(selectedEntries).filter((action) => !barIds.includes(action.id)));

  const selectSort = (field: SortKey) => {
    sortField = field;
    settings.sharedSortField = sortField;
  };

  const toggleSortDirection = () => {
    sortAscending = !sortAscending;
    settings.sharedSortAscending = sortAscending;
  };

  const sortBy = (field: SortKey) => {
    if (field === sortField) toggleSortDirection();
    else selectSort(field);
  };

  const toggleKind = (kind: FileKind) => {
    const next = new Set(hiddenKinds);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    hiddenKinds = next;
    settings.sharedHiddenKinds = [...next];
  };

  const iconOf = (entry: SharedEntry) => entryIcon(child(entry.name), entry.isDir, projectKeys, UPLOAD_DIR);


  const rowTone = (isSelected: boolean, dropping: boolean) =>
    dropping ? "bg-accent-soft" : isSelected ? "bg-surface-variant" : "";

  const dateOf = (entry: SharedEntry) => formatDateShort(entry.modified * MILLIS_PER_SECOND);

  const detailOf = (entry: SharedEntry) =>
    entry.isDir ? plural("ITEM_COUNT", entry.items) : entry.missing ? "" : formatSize(entry.size);


  const rowAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-row]");
    if (!element) return null;
    return { index: Number(element.dataset.row), name: element.dataset.name ?? "" };
  };

  const scrollEdge = (y: number) => {
    const box = list?.getBoundingClientRect();
    if (!box || !list || !pressOrigin) return;
    if (y > box.bottom - EDGE_ZONE && y > pressOrigin.y + TOUCH_SLOP) list.scrollBy(0, EDGE_STEP);
    else if (y < box.top + EDGE_ZONE && y < pressOrigin.y - TOUCH_SLOP) list.scrollBy(0, -EDGE_STEP);
  };

  const filesOf = (items: SharedEntry[]): SharedFile[] =>
    items
      .filter((entry) => !entry.isDir)
      .map((entry) => ({ path: child(entry.file), name: entry.name, size: entry.size }));

  const sharedSelection = (): SharedFile[] => filesOf(selectedEntries);

  const moved = (event: PointerEvent) =>
    !!pressOrigin && Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > TOUCH_SLOP;

  const capture = (pointerId: number) => {
    captured = pointerId;
    list?.setPointerCapture(pointerId);
  };

  const endGesture = () => {
    if (pressTimer !== null) clearTimeout(pressTimer);
    if (captured !== null && list?.hasPointerCapture(captured)) list.releasePointerCapture(captured);
    pressTimer = null;
    pressOrigin = null;
    pendingDrag = null;
    pendingFiles = [];
    heldDrag = false;
    captured = null;
    anchor = -1;
    markBase = [];
    marking = false;
    dragging = null;
    dragPoint = null;
    dropTarget = null;
  };

  const onPointerDown = (event: PointerEvent) => {
    swallowClick = false;
    touchGesture = event.pointerType === "touch";
    if (transfer || (event.pointerType === "mouse" && event.button !== 0)) return;
    const row = rowAt(event.clientX, event.clientY);
    if (!row) return;
    pressOrigin = { x: event.clientX, y: event.clientY };
    if (selected.includes(row.name)) {
      if (archive !== null) return;
      if (event.pointerType !== "touch") {
        pendingDrag = selectedEntries.map((entry) => child(entry.file));
        pendingFiles = sharedSelection();
        return;
      }
      const held = event.pointerId;
      pressTimer = setTimeout(() => {
        pressTimer = null;
        heldDrag = true;
        pendingDrag = selectedEntries.map((entry) => child(entry.file));
        pendingFiles = sharedSelection();
        capture(held);
      }, LONG_PRESS_MS);
      return;
    }
    const entry = ordered.find((item) => item.file === row.name);
    if (archive === null && event.pointerType !== "touch" && entry) {
      pendingDrag = [child(entry.file)];
      pendingFiles = filesOf([entry]);
    }
    const pointerId = event.pointerId;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      pendingDrag = null;
      pendingFiles = [];
      anchor = row.index;
      markBase = selecting ? selected : [];
      marking = true;
      selecting = true;
      selected = [...new Set([...markBase, row.name])];
      capture(pointerId);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (pressTimer !== null && moved(event)) {
      clearTimeout(pressTimer);
      pressTimer = null;
      if (!pendingDrag) pressOrigin = null;
    }
    if (pendingDrag && !dragging && moved(event)) {
      dragging = pendingDrag;
      dragTransfer.begin({ kind: "shared", files: pendingFiles });
      capture(event.pointerId);
    }
    if (dragging) {
      dragTransfer.track(event.clientX, event.clientY);
      const row = dragTransfer.over ? null : rowAt(event.clientX, event.clientY);
      const entry = row ? ordered.find((item) => item.file === row.name) : null;
      dropTarget = entry?.isDir && !dragging.includes(child(entry.file)) ? entry.file : null;
      dragPoint = { x: event.clientX, y: event.clientY };
      scrollEdge(event.clientY);
      return;
    }
    if (!marking || anchor < 0) return;
    const row = rowAt(event.clientX, event.clientY);
    if (row) {
      const [from, to] = row.index >= anchor ? [anchor, row.index] : [row.index, anchor];
      selected = [...new Set([...markBase, ...ordered.slice(from, to + 1).map((entry) => entry.file)])];
    }
    scrollEdge(event.clientY);
  };

  const onPointerUp = () => {
    const sources = dragging;
    const target = dropTarget;
    swallowClick = marking || dragging !== null || heldDrag;
    const handed = dragTransfer.release();
    endGesture();
    if (handed) {
      exitSelection();
      return;
    }
    if (!sources?.length || !target) return;
    exitSelection();
    void sharedApi.move(sources, child(target)).then(reload);
  };

  const onClickCapture = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const engaged = $derived(activeScope() === "shared");

  const shortcutsEnabled = $derived(
    engaged &&
      !searching &&
      renaming === null &&
      !creatingFolder &&
      deleting === null &&
      extractRequest === null &&
      compressing === null &&
      !navigation.previewOverlay &&
      !panes.previewing,
  );

  const cancelMode = () => {
    if (panes.previewing || navigation.preview !== null) return false;
    if (selecting) {
      exitSelection();
      return true;
    }
    if (searching) {
      searching = false;
      searchQuery = "";
      return true;
    }
    if (transfer) {
      transfer = null;
      return true;
    }
    return false;
  };

  const stepUp = () => {
    if (panes.previewing || navigation.preview !== null) return false;
    if (archive !== null || (path && path !== home)) {
      goUp();
      return true;
    }
    return false;
  };

  const stepBack = () => (isTouch ? cancelMode() || stepUp() : stepUp() || cancelMode());

  const onKeydown = (event: KeyboardEvent) => {
    if (!engaged || dismissOpen()) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    if (event.key === "Escape") {
      if (cancelMode()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
  };

  const startIfAllowed = (mode: "copy" | "move") => {
    if (!shortcutsEnabled || archive !== null || !selected.length) return false;
    startTransfer(mode);
  };

  useShortcut("shared.selectAll", () => {
    if (!shortcutsEnabled || isEditing() || !entries.length) return false;
    selectAll();
  });
  useShortcut("shared.copy", () => startIfAllowed("copy"));
  useShortcut("shared.cut", () => startIfAllowed("move"));
  useShortcut("shared.paste", () => {
    if (!shortcutsEnabled || !transfer || !transferAllowed) return false;
    void runTransfer();
  });
  useShortcut("shared.delete", () => {
    if (!selected.length) return false;
    deleting = selectedEntries;
  });

  const onPaste = (event: ClipboardEvent) => {
    if (!shortcutsEnabled || archive !== null || transfer) return;
    const files = Array.from(event.clipboardData?.files ?? []).map(pastedName);
    if (!files.length) return;
    event.preventDefault();
    pendingUploads = files;
  };

  $effect(() => {
    window.addEventListener("keydown", onKeydown, true);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeydown, true);
      window.removeEventListener("paste", onPaste);
    };
  });

  $effect(() => (engaged ? navigation.intercept(stepBack) : undefined));

  $effect(() => {
    watcher.connect();
    return () => watcher.close();
  });

  $effect(() => {
    if (compact) return;
    layout.bottomInset = docked ? bottomBar : 0;
    return () => (layout.bottomInset = 0);
  });

  $effect(() => {
    if (list) return rememberScroll(list, `shared|${slot}`);
  });

  $effect(() => {
    const element = list;
    if (!element) return;
    const block = (event: TouchEvent) => {
      if (marking || dragging) event.preventDefault();
    };
    element.addEventListener("touchmove", block, { passive: false });
    return () => element.removeEventListener("touchmove", block);
  });

  $effect(() => {
    if (!compact) syncSharedLocation({ path, archive, archiveDir });
  });


  $effect(() => {
    void backend.activeId;
    untrack(() => (transfer = null));
  });

  let listed = "";

  const remember = () => {
    if (compact && listed && loaded) rememberShared(listed, entries);
  };

  $effect(() => () => untrack(remember));

  const slot = $derived(`${backend.activeId ?? ""}|${archive ?? ""}|${archiveDir}|${path}`);

  $effect(() => {
    const current = archive;
    const target = slot;
    untrack(() => {
      remember();
      listed = target;
      exitSelection();
      endGesture();
      const saved = compact ? recallShared(target) : undefined;
      entries = saved ?? [];
      loaded = saved !== undefined;
    });
    watcher.watch(current === null ? path : current.split("/").slice(0, -1).join("/"));
    if (current !== null) void reload();
  });

  $effect(() => {
    const live = watcher.entries;
    if (!live) return;
    if (archive === null) {
      entries = live;
      loaded = true;
    } else {
      void reload();
    }
  });

  $effect(() => {
    const query = searchQuery.trim();
    if (!searching || !query) {
      searchResults = null;
      return;
    }
    const target = path;
    const timer = setTimeout(() => {
      void sharedApi.search(target, query).then((result) => {
        if (searching && searchQuery.trim() === query && path === target) searchResults = result;
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    void path;
    seenUploads = new Set(untrack(() => transfers.finished).map((item) => item.id));
  });

  $effect(() => {
    const finished = transfers.finished;
    const fresh = finished.filter((item) => !seenUploads.has(item.id));
    seenUploads = new Set(finished.map((item) => item.id));
    if (fresh.some((item) => item.kind === "upload" && item.status === "done" && item.dir === untrack(() => path))) {
      void reload();
    }
  });
</script>

{#snippet selectAllAction(inHead = false)}
  <TooltipIconButton
    label={t(allSelected ? "DESELECT_ALL" : "SELECT_ALL")}
    shortcut="shared.selectAll"
    enabled={ordered.length > 0}
    onclick={selectAll}
    class={inHead ? HEAD_SELECT_CLASS : ""}
  >
    <SelectionDot selected={allSelected} size={inHead ? iconSize : compact ? 18 : 24} />
  </TooltipIconButton>
{/snippet}

{#snippet cancelAction(inBar = false)}
  <TooltipIconButton label={t("CANCEL")} onclick={exitSelection} class={inBar ? BAR_ACTION_CLASS : ""}>
    <X />
  </TooltipIconButton>
{/snippet}

{#snippet moreMenu()}
  <PopupMenu
    open={barMenu}
    onOpenChange={(value) => (barMenu = value)}
    label={t("MORE_OPTIONS")}
  >
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("MORE_OPTIONS")} {...props}>
        <EllipsisVertical />
      </TooltipIconButton>
    {/snippet}
    <MenuSub text={t("SORT_BY")} icon={ArrowDownUp}>
      {#each SORT_KEYS as key (key)}
        <MenuItem
          text={t(SORT_LABELS[key])}
          selected={key === sortField}
          closeOnSelect={false}
          onclick={() => selectSort(key)}
        />
      {/each}
      <MenuItem text={t("SORT_ASCENDING")} closeOnSelect={false} onclick={toggleSortDirection}>
        {#snippet trailing()}
          <CompactSwitch checked={sortAscending} onCheckedChange={toggleSortDirection} />
        {/snippet}
      </MenuItem>
    </MenuSub>
    <MenuSub text={t("SHOW_KINDS")} icon={Filter}>
      {#each FILE_KINDS as kind (kind)}
        <MenuItem
          text={t(kindLabel(kind))}
          icon={kindIcon(kind)}
          closeOnSelect={false}
          onclick={() => toggleKind(kind)}
        >
          {#snippet trailing()}
            <CompactSwitch checked={!hiddenKinds.has(kind)} onCheckedChange={() => toggleKind(kind)} />
          {/snippet}
        </MenuItem>
      {/each}
    </MenuSub>
    {#if archive === null}
      <MenuItem
        text={t("NEW_FOLDER")}
        icon={FolderPlus}
        enabled={!serverStatus.unavailable}
        onclick={() => (creatingFolder = true)}
      />
    {/if}
  </PopupMenu>
{/snippet}

{#snippet browseActions()}
  {#if !transfer && archive === null}
    <TooltipIconButton
      label={t("UPLOAD_FILES")}
      enabled={!serverStatus.unavailable}
      onclick={() => picker?.click()}
    >
      <Upload />
    </TooltipIconButton>
  {/if}
  <EnvironmentAction />
  {@render moreMenu()}
{/snippet}

{#snippet headerSearch()}
  {#if archive === null}
    <SearchBar value={searchQuery} oninput={search} placeholder={t("SEARCH")} class={HEADER_SEARCH_CLASS} />
  {/if}
{/snippet}

{#snippet linkNote(entry: SharedEntry, className: string)}
  {@const LinkIcon = entry.missing ? X : Link2}
  <span class="flex min-w-0 items-baseline gap-1.5 text-caption {entry.missing ? 'text-red' : 'text-faint'} {className}">
    <LinkIcon size={12} class="shrink-0 self-center" />
    <span class="truncate">{entry.missing ? t("LINK_MISSING") : entry.link}</span>
  </span>
{/snippet}

{#snippet entryLine(entry: SharedEntry, index: number)}
  {@const isSelected = selectedSet.has(entry.file)}
  {@const dropping = dropTarget === entry.file}
  {@const Icon = iconOf(entry)}
  {@const corners = isSelected
    ? joinedCorners(selectedSet.has(ordered[index - 1]?.file), selectedSet.has(ordered[index + 1]?.file))
    : joinedCorners(false, false)}
  <div
    data-row={index}
    data-name={entry.file}
    class="group flex items-center gap-2 {isSelected ? TONE_JOINING : TONE_PARTING} {corners} {rowTone(
      isSelected,
      dropping,
    )} {isSelected || dropping ? '' : 'hover:bg-hover'}"
  >
    <Pressable
      onclick={() => openEntry(entry)}
      oncontextmenu={() => contextSelect(entry)}
      hover={false}
      class="min-w-0 flex-1 {wide ? 'flex min-h-8 w-full items-center gap-2 rounded-md px-3 py-1.5' : PREFERENCE_ROW_CLASS}"
    >
      {#if selecting}
        <SelectionDot selected={isSelected} size={iconSize} />
      {/if}
      <Icon size={iconSize} class="shrink-0 text-on-surface-variant" />
      <span class="flex min-w-0 flex-1 {wide ? 'items-baseline gap-2' : 'flex-col'}">
        <span class="max-w-full truncate text-body-md {wide ? 'shrink-0' : ''}">{entryLabel(child(entry.file), entry.name)}</span>
        {#if entry.link || entry.missing}
          {@render linkNote(entry, wide ? "flex-1" : "")}
        {:else if !wide}
          <span class="truncate text-caption text-faint">{dateOf(entry)}</span>
        {/if}
      </span>
      {#if wide}
        <span class="{SIZE_COLUMN} text-body-sm text-on-surface-variant">{detailOf(entry)}</span>
        <span class="{DATE_COLUMN} truncate text-body-sm text-on-surface-variant">{dateOf(entry)}</span>
      {:else}
        <span class="shrink-0 text-caption text-faint">{detailOf(entry)}</span>
      {/if}
    </Pressable>
    {#if rowMenus}
      <div class={PREFERENCE_TRAILING_CLASS} role="presentation" onpointerdown={(event) => event.stopPropagation()}>
        <RowMenuTrigger
          open={rowMenuOpen && rowMenu?.entry.file === entry.file}
          shown={isSelected}
          onOpen={(anchor) => {
            rowMenu = { entry, anchor };
            rowMenuOpen = true;
          }}
          onClose={() => (rowMenuOpen = false)}
        />
      </div>
    {/if}
  </div>
{/snippet}

{#snippet columnsHead()}
  <div class="sticky top-0 z-10 flex h-8 shrink-0 items-center gap-2 bg-card px-3 text-label-md text-on-surface-variant select-none">
    {@render selectAllAction(true)}
    {#if selecting}
      <span class="shrink-0" style="width: {iconSize}px"></span>
    {/if}
    {@render column("name", "min-w-0 flex-1")}
    {@render column("size", SIZE_COLUMN)}
    {@render column("date", DATE_COLUMN)}
    {#if rowMenus}
      <span class={PREFERENCE_TRAILING_CLASS}></span>
    {/if}
  </div>
{/snippet}

{#snippet column(field: SortKey, className: string)}
  <button
    type="button"
    onclick={() => sortBy(field)}
    class="flex cursor-pointer items-center gap-1 transition-colors hover:text-on-surface {field === sortField
      ? 'text-on-surface'
      : ''} {className}"
  >
    <span class="truncate">{t(SORT_LABELS[field])}</span>
    {#if field === sortField}
      {#if sortAscending}
        <ChevronUp size={14} class="shrink-0" />
      {:else}
        <ChevronDown size={14} class="shrink-0" />
      {/if}
    {/if}
  </button>
{/snippet}

{#snippet selectionActions()}
  {@const available = actionsFor(selectedEntries)}
  {#each barIds as id (id)}
    {@const action = available.find((item) => item.id === id)}
    {@const look = FILE_ACTION_LOOK[id]}
    <ToolbarAction
      {narrow}
      shortcut={BAR_SHORTCUTS[id]}
      icon={look.icon}
      label={t(look.label)}
      danger={id === "delete"}
      enabled={!!action}
      onclick={() => void action?.run()}
    />
  {/each}
  {#if barMore.length}
    <PopupMenu
      open={actionsMenu}
      onOpenChange={(value) => (actionsMenu = value)}
      label={t("MORE")}
      side="top"
    >
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("MORE")} class={BAR_ACTION_CLASS} {...props}>
          <EllipsisVertical />
        </TooltipIconButton>
      {/snippet}
      <FileActionItems actions={barMore} />
    </PopupMenu>
  {/if}
{/snippet}

<div
  bind:clientWidth={width}
  class="flex h-full min-h-0 flex-col"
  role="application"
  aria-label={t("SHARED")}
>
  {#if compact}
    <PaneHeader
      title={selecting ? plural("ITEM_COUNT", selected.length) : t("SHARED")}
      leading={selecting ? selectAllAction : undefined}
      actions={selecting ? cancelAction : browseActions}
    />
  {:else if selecting && !wide}
    <AppTopBar title={plural("ITEM_COUNT", selected.length)}>
      {#snippet navigationIcon()}
        {@render selectAllAction()}
      {/snippet}
      {#snippet actions()}
        {@render cancelAction()}
      {/snippet}
    </AppTopBar>
  {:else}
    <AppTopBar
      title={t("SHARED")}
      server
      search={wide ? headerSearch : undefined}
      actions={browseActions}
    >
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
          <ArrowLeft />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex min-h-0 flex-1 flex-col"
    use:fileDrop={{
      accepts: () => archive === null,
      drop: (files) => {
        pendingUploads = files;
      },
    }}
  >
    <DropOverlay />
    <PathBar
      path={crumbPath}
      root={ceiling}
      label={crumbLabel}
      nameOf={entryLabel}
      searching={searching && !wide}
      {narrow}
      count={shownCount}
      query={searchQuery}
      searchable={archive === null && !wide}
      onQueryChange={(value) => (searchQuery = value)}
      onToggleSearch={toggleSearch}
      onNavigate={navigateTo}
    />

    <div class="flex min-h-0 flex-1 flex-col">
      {#if serverStatus.unavailable}
        <div class="flex min-h-0 flex-1 flex-col px-(--page-inset)">
          <ServerUnavailable class="flex-1" />
        </div>
      {:else}
        <div class="flex min-h-0 flex-1 flex-col px-(--page-inset)">
          <ScrollCard
            bind:scroller={list}
            dock
            frame="flex-1 rounded-panel"
            role="presentation"
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointercancel={endGesture}
            onclickcapture={onClickCapture}
            class="flex flex-col [scrollbar-gutter:stable] {marking || dragging ? 'touch-none select-none' : ''}"
          >
            {#if wide}
              {@render columnsHead()}
            {/if}
            {#if ordered.length}
              <div use:rowWindow.track style={rowWindow.style} class="shrink-0">
                {#each rowWindow.slice(ordered) as entry, offset (entry.file)}
                  {@render entryLine(entry, rowWindow.start + offset)}
                {/each}
              </div>
            {:else}
              <EmptyState
                loading={!loaded}
                icon={querying ? NO_RESULTS_ICON : FolderOpen}
                text={t(querying ? "NO_RESULTS" : "NO_FILES")}
                class="flex-1"
              />
            {/if}
          </ScrollCard>
        </div>
        {#if rowMenu}
          <PopupMenu
            open={rowMenuOpen}
            onOpenChange={(open) => (rowMenuOpen = open)}
            anchor={rowMenu.anchor}
            label={t("MORE_OPTIONS")}
          >
            <FileActionItems
              actions={rowActions(selectedSet.has(rowMenu.entry.file) ? selectedEntries : [rowMenu.entry])}
            />
          </PopupMenu>
        {/if}
      {/if}
    </div>

    <div bind:clientHeight={bottomBar} class={BAR_REGION_CLASS}>
      {#if transfer}
        <div transition:slide={{ duration: SLIDE_MS }} class={BAR_DOCK_CLASS}>
          <div class="flex items-center gap-2 rounded-panel bg-card p-1 {narrow ? '' : 'justify-end'}">
            <Button onclick={() => (transfer = null)} variant="outlined" class={narrow ? "grow basis-0" : ""}>
              {t("CANCEL")}
            </Button>
            <Button onclick={() => void runTransfer()} enabled={transferAllowed} class={narrow ? "grow basis-0" : ""}>
              {transfer.kind === "move" ? t("MOVE_HERE") : transfer.kind === "copy" ? t("COPY_HERE") : t("EXTRACT_HERE")}
            </Button>
          </div>
        </div>
      {:else if selectionBar}
        <div transition:slide={{ duration: SLIDE_MS }} class={BAR_DOCK_CLASS}>
          <div class={BAR_CARD_CLASS}>
            {#if wide}
              <p class={BAR_LABEL_CLASS}>{plural("ITEM_COUNT", selected.length)}</p>
            {/if}
            {#if selected.length}
              <div class="flex min-w-0 items-center justify-end gap-1 {wide ? '' : 'flex-1'}">
                {@render selectionActions()}
              </div>
            {/if}
            {#if wide}
              {@render cancelAction(true)}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if dragging && dragPoint}
  <div
    style="left: {dragPoint.x + 12}px; top: {dragPoint.y + 12}px"
    class="pointer-events-none fixed z-50 {TOOLTIP_CLASS}"
  >
    {plural("ITEM_COUNT", dragging.length)}
  </div>
{/if}

<input
  bind:this={picker}
  type="file"
  multiple
  onchange={(event) => {
    const input = event.currentTarget as HTMLInputElement;
    pendingUploads = Array.from(input.files ?? []);
    input.value = "";
  }}
  class="hidden"
/>

{#if pendingUploads.length}
  {@const files = pendingUploads}
  <ConfirmDialog
    title={t("UPLOAD_FILES")}
    text={plural("UPLOAD_CONFIRM", files.length)}
    confirmLabel={t("UPLOAD")}
    onConfirm={() => {
      const taken = new Set(entries.map((entry) => entry.name));
      const clashes = files.filter((file) => taken.has(file.name));
      if (clashes.length) {
        uploading = files;
        clashing = clashes.map((file) => file.name);
      } else {
        files.forEach((file) => transfers.upload(file, path));
      }
      pendingUploads = [];
    }}
    onDismiss={() => (pendingUploads = [])}
  />
{/if}

{#if clashing}
  <ClashDialog
    names={clashing}
    onChoose={(policy) => {
      const files = uploading;
      clashing = null;
      if (!files) {
        void runTransfer(policy);
        return;
      }
      uploading = null;
      files.forEach((file) => transfers.upload(file, path, policy));
    }}
    onDismiss={() => {
      clashing = null;
      uploading = null;
    }}
  />
{/if}

{#if deleting?.length}
  {@const items = deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={items.length === 1
      ? t(items[0].link ? "DELETE_LINK_CONFIRM" : "DELETE_FILE_CONFIRM", items[0].name)
      : t("DELETE_ITEMS_CONFIRM", items.length)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => {
      const targets = items.map((entry) => child(entry.file));
      deleting = null;
      finishWith(items);
      void Promise.all(targets.map((target) => sharedApi.remove(target))).then(reload);
    }}
    onDismiss={() => (deleting = null)}
  />
{/if}

{#if renaming}
  {@const entry = renaming}
  {@const { base, extension } = splitName(entry.name, entry.isDir)}
  <RenameDialog
    initial={base}
    suffix={extension ? `.${extension}` : null}
    errorOf={(input) => {
      const full = extension ? `${input.trim()}.${extension}` : input.trim();
      return full !== entry.name && entries.some((item) => item.name.toLowerCase() === full.toLowerCase())
        ? t("ALREADY_EXISTS")
        : null;
    }}
    onConfirm={(input) => {
      const target = entry;
      const full = extension ? `${input.trim()}.${extension}` : input.trim();
      renaming = null;
      finishWith([target]);
      void sharedApi.rename(child(target.file), full).then(reload);
    }}
    onDismiss={() => (renaming = null)}
  />
{/if}

{#if creatingFolder}
  <RenameDialog
    initial=""
    title={t("NEW_FOLDER")}
    confirmLabel={t("CREATE")}
    errorOf={(input) =>
      entries.some((item) => item.name.toLowerCase() === input.trim().toLowerCase()) ? t("ALREADY_EXISTS") : null}
    onConfirm={(name) => {
      creatingFolder = false;
      void sharedApi.mkdir(child(name.trim())).then(reload);
    }}
    onDismiss={() => (creatingFolder = false)}
  />
{/if}

{#if compressing}
  {@const items = compressing}
  <CompressDialog
    defaultName={items.length === 1 ? archiveNameOf(items[0]) : pathLabel(path) || t("SHARED").toLowerCase()}
    onConfirm={(name, format) => {
      const targets = items.map((entry) => child(entry.file));
      compressing = null;
      void sharedApi.compress(targets, format, name).then(() => {
        finishWith(items);
        return reload();
      });
    }}
    onDismiss={() => (compressing = null)}
  />
{/if}

{#if extractRequest}
  {@const request = extractRequest}
  <CompactDialog title={t("EXTRACT")} onDismiss={() => (extractRequest = null)}>
    {#snippet buttons()}
      <Button onclick={() => (extractRequest = null)} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    <DialogActionItem
      text={t("EXTRACT_TO_FOLDER", request.stem)}
      icon={Folder}
      onclick={() => {
        const target = request;
        extractRequest = null;
        void sharedApi
          .extract(target.archive, { intoFolder: true, members: target.members, base: target.base })
          .then(() => {
            exitSelection();
            if (archive !== null) {
              archive = null;
              archiveDir = "";
            } else {
              void reload();
            }
          });
      }}
    />
    <DialogActionItem
      text={t("EXTRACT_HERE")}
      icon={PackageOpen}
      onclick={() => {
        const target = request;
        extractRequest = null;
        void sharedApi
          .extract(target.archive, { intoFolder: false, members: target.members, base: target.base })
          .then(() => {
            exitSelection();
            if (archive !== null) {
              archive = null;
              archiveDir = "";
            } else {
              void reload();
            }
          });
      }}
    />
    <DialogActionItem
      text={t("EXTRACT_TO")}
      icon={FolderInput}
      onclick={() => {
        const target = request;
        extractRequest = null;
        transfer = {
          kind: "extract",
          paths: [target.archive],
          sourceDir: path,
          folders: [],
          members: target.members,
          base: target.base,
        };
        if (archive !== null) {
          path = target.archive.split("/").slice(0, -1).join("/");
          archive = null;
          archiveDir = "";
        }
        exitSelection();
      }}
    />
  </CompactDialog>
{/if}
