<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowDownUp from "@lucide/svelte/icons/arrow-down-up";
  import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
  import { copyText } from "$lib/platform/clipboard";
  import Copy from "@lucide/svelte/icons/copy";
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Eye from "@lucide/svelte/icons/eye";
  import FileIcon from "@lucide/svelte/icons/file";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import PackageOpen from "@lucide/svelte/icons/package-open";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Trash from "@lucide/svelte/icons/trash";
  import Upload from "@lucide/svelte/icons/upload";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import { slide } from "svelte/transition";
  import { navigation } from "$lib/app/navigation.svelte";
  import { formatSize, isArchive } from "$lib/data/format";
  import { isPreviewable, previewKindOf } from "$lib/data/previewKind";
  import { settings } from "$lib/data/settings.svelte";
  import { formatDateShort } from "$lib/data/time";
  import { transfers } from "$lib/data/transfers.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { COMPACT_WIDTH, layout } from "$lib/platform/layout.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import {
    archiveFileUrl,
    downloadUrl,
    sharedApi,
    type SharedEntry,
  } from "$lib/services/sharedApi";
  import {
    downloadShared,
    openAllSharedExternally,
    openSharedExternally,
    openSharedInBrowser,
    saveAllShared,
    saveSharedAs,
  } from "$lib/services/sharedFiles";
  import { SharedWatch } from "$lib/services/sharedWatch.svelte";
  import { activeScope } from "$lib/app/activeScope.svelte";
  import EnvironmentAction from "$lib/screens/chat/EnvironmentAction.svelte";
  import { paneActionClass } from "$lib/screens/chat/paneChrome";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DialogActionItem from "$lib/ui/DialogActionItem.svelte";
  import DropOverlay from "$lib/ui/DropOverlay.svelte";
  import { hasFiles } from "$lib/ui/fileDrop";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SelectionDot from "$lib/ui/SelectionDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import PathBar from "./PathBar.svelte";
  import CompressDialog from "./CompressDialog.svelte";
  import { readFilesLocation, syncFilesLocation } from "./filesUrl";
  import ToolbarAction from "./ToolbarAction.svelte";
  import { pastedName } from "$lib/data/pastedFile";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";

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

  interface Props {
    compact?: boolean;
  }

  const { compact = false }: Props = $props();

  const actionClass = $derived(paneActionClass(compact));

  let width = $state(0);

  const narrow = $derived(width < COMPACT_WIDTH);

  const SEARCH_DELAY_MS = 300;
  const MILLIS_PER_SECOND = 1000;
  const SLIDE_MS = 150;
  const LONG_PRESS_MS = 500;
  const DRAG_SLOP = 8;
  const EDGE_ZONE = 96;
  const EDGE_STEP = 24;
  const SORT_KEYS: SortKey[] = ["name", "date", "type", "size"];
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
  const initial = readFilesLocation();

  let path = $state(initial?.path ?? "");
  let archive = $state<string | null>(initial?.archive ?? null);
  let archiveDir = $state(initial?.archiveDir ?? "");
  let entries = $state<SharedEntry[]>([]);
  let loaded = $state(false);
  let selecting = $state(false);
  let selected = $state<string[]>([]);
  let transfer = $state<TransferOp | null>(null);
  let searching = $state(false);
  let searchQuery = $state("");
  let searchResults = $state<SharedEntry[] | null>(null);
  let sortField = $state<SortKey>(settings.fileSortField as SortKey);
  let sortAscending = $state(settings.fileSortAscending);
  let confirmingDelete = $state(false);
  let renaming = $state<SharedEntry | null>(null);
  let creatingFolder = $state(false);
  let compressing = $state<string[] | null>(null);
  let extractRequest = $state<ExtractRequest | null>(null);
  let barMenu = $state(false);
  let actionsMenu = $state(false);
  let bottomBar = $state(0);
  let pendingUploads = $state<File[]>([]);
  let picker = $state<HTMLInputElement | null>(null);
  let dropOver = $state(false);
  let dropTarget = $state<string | null>(null);
  let dragging = $state<string[] | null>(null);
  let dragPoint = $state<{ x: number; y: number } | null>(null);
  let marking = $state(false);
  let list = $state<HTMLElement | null>(null);
  let seenUploads = new Set<number>();
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pressOrigin: { x: number; y: number } | null = null;
  let pendingDrag: string[] | null = null;
  let captured: number | null = null;
  let swallowClick = false;
  let anchor = -1;
  let markBase: string[] = [];

  const environment = $derived(backend.active);

  const child = (name: string) => (path ? `${path}/${name}` : name);
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

  const ordered = $derived.by(() => {
    const list = [...(searchResults ?? entries)];
    const direction = sortAscending ? 1 : -1;
    const compare = (a: SharedEntry, b: SharedEntry) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      if (sortField === "date") return direction * (a.modified - b.modified);
      if (sortField === "size") {
        return direction * ((a.isDir ? a.items : a.size) - (b.isDir ? b.items : b.size));
      }
      if (sortField === "type") {
        const byType = extensionOf(a.name).localeCompare(extensionOf(b.name));
        return direction * (byType || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      }
      return direction * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    };
    return list.sort(compare);
  });

  const selectedEntries = $derived(entries.filter((entry) => selected.includes(entry.name)));
  const single = $derived(selected.length === 1 ? (selectedEntries[0] ?? null) : null);
  const canShare = $derived(selectedEntries.length > 0 && selectedEntries.every((entry) => !entry.isDir));
  const allSelected = $derived(entries.length > 0 && selected.length === entries.length);
  const transferAllowed = $derived(
    transfer !== null &&
      archive === null &&
      !transfer.folders.some((folder) => path === folder || path.startsWith(`${folder}/`)) &&
      (transfer.kind !== "move" || path !== transfer.sourceDir),
  );

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
    entries = (await sharedApi.archiveList(current, archiveDir)) ?? [];
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

  const toggle = (name: string) => {
    selected = selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name];
  };

  const openEntry = (entry: SharedEntry) => {
    if (selecting) {
      toggle(entry.name);
      return;
    }
    if (entry.isDir) {
      if (archive !== null) archiveDir = innerChild(entry.name);
      else {
        path = child(entry.name);
        searching = false;
        searchQuery = "";
      }
      navigation.pushLayer();
      return;
    }
    if (archive !== null) {
      if (isPreviewable(entry.name)) {
        navigation.openPreview({
          url: archiveFileUrl(archive, innerChild(entry.name)),
          name: entry.name,
          onDelete: null,
        });
      } else if (!transfer) {
        selecting = true;
        selected = [entry.name];
      }
      return;
    }
    if (isArchive(entry.name)) {
      archive = child(entry.name);
      archiveDir = "";
      searching = false;
      searchQuery = "";
      return;
    }
    if (isPreviewable(entry.name)) {
      const relative = child(entry.name);
      navigation.openPreview({
        url: downloadUrl(relative),
        name: entry.name,
        onDelete: () => void sharedApi.remove(relative).then(reload),
      });
      return;
    }
    if (!transfer) {
      selecting = true;
      selected = [entry.name];
    }
  };

  const startTransfer = (kind: TransferKind) => {
    transfer = {
      kind,
      paths: selectedEntries.map((entry) => child(entry.name)),
      sourceDir: path,
      folders: selectedEntries.filter((entry) => entry.isDir).map((entry) => child(entry.name)),
    };
    exitSelection();
  };

  const runTransfer = async () => {
    const op = transfer;
    if (!op) return;
    if (op.kind === "move") await sharedApi.move(op.paths, path);
    else if (op.kind === "copy") await sharedApi.copy(op.paths, path);
    else {
      await sharedApi.extract(op.paths[0], {
        dest: path,
        intoFolder: false,
        members: op.members,
        base: op.base,
      });
    }
    transfer = null;
    await reload();
  };

  const selectSort = (field: SortKey) => {
    sortField = field;
    settings.fileSortField = sortField;
  };

  const toggleSortDirection = () => {
    sortAscending = !sortAscending;
    settings.fileSortAscending = sortAscending;
  };

  const detailOf = (entry: SharedEntry) =>
    entry.isDir ? plural("ITEM_COUNT", entry.items) : formatSize(entry.size);

  const rowAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-row]");
    if (!element) return null;
    return { index: Number(element.dataset.row), name: element.dataset.name ?? "" };
  };

  const scrollEdge = (y: number) => {
    const box = list?.getBoundingClientRect();
    if (!box || !list) return;
    if (y > box.bottom - EDGE_ZONE) list.scrollBy(0, EDGE_STEP);
    else if (y < box.top + EDGE_ZONE) list.scrollBy(0, -EDGE_STEP);
  };

  const moved = (event: PointerEvent) =>
    !!pressOrigin && Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > DRAG_SLOP;

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
    if (transfer || (event.pointerType === "mouse" && event.button !== 0)) return;
    const row = rowAt(event.clientX, event.clientY);
    if (!row) return;
    pressOrigin = { x: event.clientX, y: event.clientY };
    if (selected.includes(row.name)) {
      if (archive === null) pendingDrag = selectedEntries.map((entry) => child(entry.name));
      return;
    }
    const pointerId = event.pointerId;
    pressTimer = setTimeout(() => {
      pressTimer = null;
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
      pressOrigin = null;
    }
    if (pendingDrag && !dragging && moved(event)) {
      dragging = pendingDrag;
      capture(event.pointerId);
    }
    if (dragging) {
      const row = rowAt(event.clientX, event.clientY);
      const entry = row ? ordered.find((item) => item.name === row.name) : null;
      dropTarget = entry?.isDir && !dragging.includes(child(entry.name)) ? entry.name : null;
      dragPoint = { x: event.clientX, y: event.clientY };
      scrollEdge(event.clientY);
      return;
    }
    if (!marking || anchor < 0) return;
    const row = rowAt(event.clientX, event.clientY);
    if (row) {
      const [from, to] = row.index >= anchor ? [anchor, row.index] : [row.index, anchor];
      selected = [...new Set([...markBase, ...ordered.slice(from, to + 1).map((entry) => entry.name)])];
    }
    scrollEdge(event.clientY);
  };

  const onPointerUp = () => {
    const sources = dragging;
    const target = dropTarget;
    swallowClick = marking || dragging !== null;
    endGesture();
    if (!sources?.length || !target) return;
    exitSelection();
    void sharedApi.move(sources, child(target)).then(reload);
  };

  const onDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dropOver = false;
    if (archive !== null) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) pendingUploads = files;
  };

  const engaged = $derived(activeScope() === "files");

  const shortcutsEnabled = $derived(
    engaged &&
      !searching &&
      renaming === null &&
      !creatingFolder &&
      !confirmingDelete &&
      extractRequest === null &&
      compressing === null &&
      navigation.preview === null,
  );

  const stepBack = () => {
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
    if (archive !== null || path) {
      goUp();
      return true;
    }
    return false;
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (!engaged) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    if (event.key === "Escape") {
      if (stepBack()) {
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

  useShortcut("files.copy", () => startIfAllowed("copy"));
  useShortcut("files.cut", () => startIfAllowed("move"));
  useShortcut("files.paste", () => {
    if (!shortcutsEnabled || !transfer || !transferAllowed) return false;
    void runTransfer();
  });
  useShortcut("files.delete", () => {
    if (!selected.length) return false;
    confirmingDelete = true;
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
    const visible = transfer !== null || (selecting && selected.length > 0);
    layout.bottomInset = visible ? bottomBar : 0;
    return () => (layout.bottomInset = 0);
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
    syncFilesLocation({ path, archive, archiveDir });
  });

  $effect(() => {
    const onPopState = () => {
      const location = readFilesLocation();
      if (!location) return;
      path = location.path;
      archive = location.archive;
      archiveDir = location.archiveDir;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  });

  $effect(() => {
    void backend.activeId;
    untrack(() => (transfer = null));
  });

  $effect(() => {
    void backend.activeId;
    const current = archive;
    void path;
    void archiveDir;
    exitSelection();
    endGesture();
    loaded = false;
    entries = [];
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


<div
  bind:clientWidth={width}
  class="flex h-full flex-col"
  role="application"
  aria-label={t("FILES")}
>
  {#snippet selectAllAction()}
    <TooltipIconButton
      label={t("SELECT_ALL")}
      class={actionClass}
      onclick={() => (selected = allSelected ? [] : entries.map((entry) => entry.name))}
    >
      <SelectionDot selected={allSelected} />
    </TooltipIconButton>
  {/snippet}

  {#snippet cancelAction()}
    <TooltipIconButton label={t("CANCEL")} class={actionClass} onclick={exitSelection}>
      <X />
    </TooltipIconButton>
  {/snippet}

  {#snippet browseActions()}
    {#if !transfer && archive === null}
      <TooltipIconButton label={t("UPLOAD_FILES")} class={actionClass} onclick={() => picker?.click()}>
        <Upload />
      </TooltipIconButton>
    {/if}
    <EnvironmentAction {compact} />
    <PopupMenu
      open={barMenu}
      onOpenChange={(value) => (barMenu = value)}
      label={t("MORE_OPTIONS")}
      align="center"
    >
      {#snippet triggerChild(props)}
        <TooltipIconButton label={t("MORE_OPTIONS")} class={actionClass} {...props}>
          <EllipsisVertical />
        </TooltipIconButton>
      {/snippet}
      <MenuSub text={t("SORT_BY")}>
        {#snippet leading()}
          <ArrowDownUp size={20} class="shrink-0 text-on-surface-variant" />
        {/snippet}
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
      {#if archive === null}
        <MenuItem text={t("NEW_FOLDER")} onclick={() => (creatingFolder = true)}>
          {#snippet leading()}
            <FolderPlus size={20} class="shrink-0 text-on-surface-variant" />
          {/snippet}
        </MenuItem>
      {/if}
    </PopupMenu>
  {/snippet}

  {#if compact}
    <PaneHeader
      title={selecting ? plural("ITEM_COUNT", selected.length) : t("FILES")}
      leading={selecting ? selectAllAction : undefined}
      actions={selecting ? cancelAction : browseActions}
    />
  {:else if selecting}
    <AppTopBar title={plural("ITEM_COUNT", selected.length)}>
      {#snippet navigationIcon()}
        {@render selectAllAction()}
      {/snippet}
      {#snippet actions()}
        {@render cancelAction()}
      {/snippet}
    </AppTopBar>
  {:else}
    <AppTopBar title={t("FILES")} subtitle={environment?.name ?? null}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
          <ArrowLeft size={20} />
        </TooltipIconButton>
      {/snippet}
      {#snippet actions()}
        {@render browseActions()}
      {/snippet}
    </AppTopBar>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex min-h-0 flex-1 flex-col"
    ondragover={(event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dropOver = archive === null;
    }}
    ondragleave={(event) => {
      if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) dropOver = false;
    }}
    ondrop={onDrop}
  >
  <DropOverlay visible={dropOver} />
  <PathBar
    path={archive === null ? path : [archive, archiveDir].filter(Boolean).join("/")}
    {searching}
    query={searchQuery}
    searchable={archive === null}
    onQueryChange={(value) => (searchQuery = value)}
    onToggleSearch={() => {
      searching = !searching;
      if (!searching) searchQuery = "";
    }}
    onNavigate={(target) => {
      const current = archive;
      if (current !== null && (target === current || target.startsWith(`${current}/`))) {
        archiveDir = target.slice(current.length).replace(/^\/+/, "");
      } else {
        archive = null;
        archiveDir = "";
        path = target;
      }
    }}
  />

  <div class="relative min-h-0 flex-1">
    {#if ordered.length}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={list}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={endGesture}
        onclickcapture={(event) => {
          if (!swallowClick) return;
          swallowClick = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        class="h-full overflow-y-auto {marking || dragging ? 'touch-none select-none' : ''}"
      >
        {#each ordered as entry, index (entry.name)}
          {@const isSelected = selected.includes(entry.name)}
          <div data-row={index} data-name={entry.name}>
            <ListRow
              icon={entry.isDir ? Folder : isArchive(entry.name) ? FolderArchive : FileIcon}
              title={entry.name}
              subtitle={formatDateShort(entry.modified * MILLIS_PER_SECOND)}
              class={dropTarget === entry.name ? "bg-accent/15" : ""}
              onclick={() => openEntry(entry)}
              oncontextmenu={() => {
                if (transfer) return;
                selecting = true;
                toggle(entry.name);
              }}
            >
              {#snippet leading()}
                {#if selecting}
                  <div class="mr-2 flex w-6 items-center">
                    <SelectionDot selected={isSelected} />
                  </div>
                {/if}
              {/snippet}
              {#snippet subtitleTrailing()}
                <span class="px-2 text-body-sm font-bold text-on-surface-variant">{detailOf(entry)}</span>
              {/snippet}
            </ListRow>
          </div>
        {/each}
      </div>
    {:else if !loaded}
      <CenteredProgress class="h-full" />
    {:else}
      <EmptyState text={t("NO_FILES")} class="h-full" />
    {/if}

  </div>

  {#if transfer}
    <div
      transition:slide={{ duration: SLIDE_MS }}
      bind:clientHeight={bottomBar}
      class="flex gap-3 bg-surface px-4 py-2.5"
    >
      <Button onclick={() => (transfer = null)} variant="outlined" class="flex-1">{t("CANCEL")}</Button>
      <Button onclick={() => void runTransfer()} enabled={transferAllowed} class="flex-1">
        {transfer.kind === "move" ? t("MOVE_HERE") : transfer.kind === "copy" ? t("COPY_HERE") : t("EXTRACT_HERE")}
      </Button>
    </div>
  {:else if selecting && selected.length && archive !== null}
    {@const current = archive}
    <div
      transition:slide={{ duration: SLIDE_MS }}
      bind:clientHeight={bottomBar}
      class="flex items-center justify-end gap-1 border-t border-outline-variant bg-surface px-3 py-2"
    >
      <ToolbarAction
        {narrow}
        icon={PackageOpen}
        label={t("EXTRACT")}
        onclick={() =>
          (extractRequest = {
            archive: current,
            members: selectedEntries.map((entry) => innerChild(entry.name)),
            base: archiveDir,
            stem: archiveStem(current.split("/").pop() ?? current),
          })}
      />
      <ToolbarAction
        {narrow}
        icon={Eye}
        label={t("VIEW")}
        enabled={!!single && !single.isDir && isPreviewable(single.name)}
        onclick={() => {
          if (!single) return;
          navigation.openPreview({
            url: archiveFileUrl(current, innerChild(single.name)),
            name: single.name,
            onDelete: null,
          });
          exitSelection();
        }}
      />
      <ToolbarAction
        {narrow}
        icon={Download}
        label={t("SAVE")}
        enabled={canShare}
        onclick={() => {
          selectedEntries.forEach((entry) =>
            void downloadShared(archiveFileUrl(current, innerChild(entry.name)), entry.name),
          );
          exitSelection();
        }}
      />
    </div>
  {:else if selecting && selected.length}
    <div
      transition:slide={{ duration: SLIDE_MS }}
      bind:clientHeight={bottomBar}
      class="flex items-center justify-end gap-1 border-t border-outline-variant bg-surface px-3 py-2"
    >
      <ToolbarAction
        {narrow}
        shortcut="files.cut"
        icon={FolderInput}
        label={t("MOVE")}
        onclick={() => startTransfer("move")}
      />
      <ToolbarAction
        {narrow}
        shortcut="files.copy"
        icon={Copy}
        label={t("COPY")}
        onclick={() => startTransfer("copy")}
      />
      <ToolbarAction
        {narrow}
        icon={Share2}
        label={t("SHARE")}
        enabled={canShare}
        onclick={() => {
          const files = selectedEntries.map((entry) => ({ url: downloadUrl(child(entry.name)), name: entry.name }));
          if (files.length === 1) void openSharedExternally(files[0].url, files[0].name);
          else void openAllSharedExternally(files);
          exitSelection();
        }}
      />
      <ToolbarAction
        {narrow}
        shortcut="files.delete"
        icon={Trash}
        label={t("DELETE")}
        onclick={() => (confirmingDelete = true)}
      />
      <PopupMenu
        open={actionsMenu}
        onOpenChange={(value) => (actionsMenu = value)}
        label={t("MORE")}
        side="top"
        align="center"
        triggerClass="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full transition-colors hover:bg-on-surface/8 {narrow
          ? 'w-8'
          : 'px-3 text-label-lg'}"
      >
        {#snippet trigger()}
          <EllipsisVertical size={narrow ? 20 : 18} class="shrink-0" />
          {#if !narrow}
            <span class="truncate">{t("MORE")}</span>
          {/if}
        {/snippet}
            {#if single && !single.isDir && isPreviewable(single.name)}
              <MenuItem
                text={t("VIEW")}
                onclick={() => {
                  const relative = child(single.name);
                  navigation.openPreview({
                    url: downloadUrl(relative),
                    name: single.name,
                    onDelete: () => void sharedApi.remove(relative).then(reload),
                  });
                  exitSelection();
                }}
              >
                {#snippet leading()}
                  <Eye size={20} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
            {#if single && !single.isDir && previewKindOf(single.name) === "html"}
              <MenuItem
                text={t("OPEN_IN_BROWSER")}
                onclick={() => {
                  const name = single.name;
                  void openSharedInBrowser(downloadUrl(child(name)), name);
                  exitSelection();
                }}
              >
                {#snippet leading()}
                  <ExternalLink size={20} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
            {#if single}
              <MenuItem text={t("RENAME")} onclick={() => (renaming = single)}>
                {#snippet leading()}
                  <Pencil size={20} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
            {#if canShare}
              <MenuItem
                text={t("SAVE")}
                onclick={() => {
                  selectedEntries.forEach((entry) =>
                    void downloadShared(downloadUrl(child(entry.name)), entry.name),
                  );
                  exitSelection();
                }}
              >
                {#snippet leading()}
                  <Download size={20} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
              <MenuItem
                text={t("SAVE_AS")}
                onclick={() => {
                  const files = selectedEntries.map((entry) => ({
                    url: downloadUrl(child(entry.name)),
                    name: entry.name,
                  }));
                  if (files.length === 1) void saveSharedAs(files[0].url, files[0].name);
                  else void saveAllShared(files);
                  exitSelection();
                }}
              >
                {#snippet leading()}
                  <Save size={20} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
            <MenuItem
              text={t("COPY_PATH")}
              onclick={() => {
                void sharedApi
                  .absolutePaths(selectedEntries.map((entry) => child(entry.name)))
                  .then((paths) => paths && copyText(paths.join("\n")));
                exitSelection();
              }}
            >
              {#snippet leading()}
                <ClipboardCopy size={20} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            <MenuItem
              text={t("COMPRESS")}
              onclick={() => (compressing = selectedEntries.map((entry) => child(entry.name)))}
            >
              {#snippet leading()}
                <FolderArchive size={20} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            {#if single && !single.isDir && isArchive(single.name)}
              <MenuItem
                text={t("EXTRACT")}
                onclick={() =>
                  (extractRequest = {
                    archive: child(single.name),
                    members: null,
                    base: "",
                    stem: archiveStem(single.name),
                  })}
              >
                {#snippet leading()}
                  <PackageOpen size={20} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
      </PopupMenu>
    </div>
  {/if}
  </div>
</div>

{#if dragging && dragPoint}
  <div
    style="left: {dragPoint.x + 12}px; top: {dragPoint.y + 12}px"
    class="pointer-events-none fixed z-50 rounded-sm border border-outline-variant bg-surface-variant px-2 py-1 text-body-sm shadow-lg"
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
      files.forEach((file) => transfers.upload(file, path));
      pendingUploads = [];
    }}
    onDismiss={() => (pendingUploads = [])}
  />
{/if}

{#if confirmingDelete && selectedEntries.length}
  <ConfirmDialog
    title={t("DELETE")}
    text={selectedEntries.length === 1
      ? t("DELETE_FILE_CONFIRM", selectedEntries[0].name)
      : t("DELETE_ITEMS_CONFIRM", selectedEntries.length)}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      const targets = selectedEntries.map((entry) => child(entry.name));
      confirmingDelete = false;
      exitSelection();
      void Promise.all(targets.map((target) => sharedApi.remove(target))).then(reload);
    }}
    onDismiss={() => (confirmingDelete = false)}
  />
{/if}

{#if renaming}
  {@const entry = renaming}
  {@const extension = entry.isDir ? "" : extensionOf(entry.name)}
  {@const base = extension ? entry.name.slice(0, -(extension.length + 1)) : entry.name}
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
      const full = extension ? `${input.trim()}.${extension}` : input.trim();
      renaming = null;
      exitSelection();
      void sharedApi.rename(child(entry.name), full).then(reload);
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
  {@const paths = compressing}
  <CompressDialog
    defaultName={paths.length === 1
      ? archiveStem(paths[0].split("/").pop() ?? "")
      : (path.split("/").pop() ?? "") || t("FILES").toLowerCase()}
    onConfirm={(name, format) => {
      compressing = null;
      void sharedApi.compress(paths, format, name).then(() => {
        exitSelection();
        return reload();
      });
    }}
    onDismiss={() => (compressing = null)}
  />
{/if}

{#if extractRequest}
  {@const request = extractRequest}
  <CompactDialog title={t("EXTRACT")} padded={false} onDismiss={() => (extractRequest = null)}>
    {#snippet buttons()}
      <Button onclick={() => (extractRequest = null)} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    <DialogActionItem
      text={t("EXTRACT_TO_FOLDER", request.stem)}
      icon={Folder}
      onclick={() => {
        extractRequest = null;
        void sharedApi
          .extract(request.archive, { intoFolder: true, members: request.members, base: request.base })
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
        extractRequest = null;
        void sharedApi
          .extract(request.archive, { intoFolder: false, members: request.members, base: request.base })
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
        extractRequest = null;
        transfer = {
          kind: "extract",
          paths: [request.archive],
          sourceDir: path,
          folders: [],
          members: request.members,
          base: request.base,
        };
        if (archive !== null) {
          path = request.archive.split("/").slice(0, -1).join("/");
          archive = null;
          archiveDir = "";
        }
        exitSelection();
      }}
    />
  </CompactDialog>
{/if}

