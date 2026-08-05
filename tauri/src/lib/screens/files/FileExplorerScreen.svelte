<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
  import Copy from "@lucide/svelte/icons/copy";
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Eye from "@lucide/svelte/icons/eye";
  import FileIcon from "@lucide/svelte/icons/file";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import PackageOpen from "@lucide/svelte/icons/package-open";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Save from "@lucide/svelte/icons/save";
  import Search from "@lucide/svelte/icons/search";
  import Server from "@lucide/svelte/icons/server";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Trash from "@lucide/svelte/icons/trash";
  import X from "@lucide/svelte/icons/x";
  import { DropdownMenu } from "bits-ui";
  import { slide } from "svelte/transition";
  import { navigation } from "$lib/app/navigation.svelte";
  import { formatSize, isArchive } from "$lib/data/format";
  import { isPreviewable } from "$lib/data/previewKind";
  import { settings } from "$lib/data/settings.svelte";
  import { formatDayTime } from "$lib/data/time";
  import { uploads } from "$lib/data/uploads.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import {
    archiveFileUrl,
    downloadUrl,
    sharedApi,
    type SharedEntry,
  } from "$lib/services/sharedApi";
  import { downloadShared, openSharedExternally, saveSharedAs } from "$lib/services/sharedFiles";
  import { SharedWatch } from "$lib/services/sharedWatch.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DialogActionItem from "$lib/ui/DialogActionItem.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import SelectionDot from "$lib/ui/SelectionDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import Breadcrumb from "./Breadcrumb.svelte";
  import CompressDialog from "./CompressDialog.svelte";
  import { readFilesLocation, syncFilesLocation } from "./filesUrl";
  import ToolbarAction from "./ToolbarAction.svelte";
  import UploadIndicator from "./UploadIndicator.svelte";

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

  const SEARCH_DELAY_MS = 300;
  const MILLIS_PER_SECOND = 1000;
  const SLIDE_MS = 150;
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
  let envOpen = $state(false);
  let confirmingDelete = $state(false);
  let renaming = $state<SharedEntry | null>(null);
  let creatingFolder = $state(false);
  let compressing = $state<string[] | null>(null);
  let extractRequest = $state<ExtractRequest | null>(null);
  let pendingUploads = $state<File[]>([]);
  let picker = $state<HTMLInputElement | null>(null);
  let dropOver = $state(false);
  let dropTarget = $state<string | null>(null);
  let dragging = $state<string[] | null>(null);

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

  const setSort = (field: SortKey) => {
    if (field === sortField) sortAscending = !sortAscending;
    else {
      sortField = field;
      sortAscending = true;
    }
    settings.fileSortField = sortField;
    settings.fileSortAscending = sortAscending;
  };

  const detailOf = (entry: SharedEntry) =>
    entry.isDir ? plural("ITEM_COUNT", entry.items) : formatSize(entry.size);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    dropOver = false;
    if (archive !== null) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) pendingUploads = files;
  };

  const onKeydown = (event: KeyboardEvent) => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    if (event.key === "Escape") {
      const consumed = selecting || searching || transfer !== null;
      if (selecting) exitSelection();
      else if (searching) {
        searching = false;
        searchQuery = "";
      } else if (transfer) transfer = null;
      if (consumed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    if (event.key === "Delete" && selected.length) confirmingDelete = true;
  };

  $effect(() => {
    window.addEventListener("keydown", onKeydown, true);
    return () => window.removeEventListener("keydown", onKeydown, true);
  });

  $effect(() => {
    watcher.connect();
    return () => watcher.close();
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
    const current = archive;
    void path;
    void archiveDir;
    exitSelection();
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
      void sharedApi.search(target, query).then((result) => (searchResults = result));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const done = uploads.items.filter((item) => item.status === "done" && item.dir === path);
    if (done.length) void reload();
  });
</script>


<div class="flex h-full flex-col" role="application" aria-label={t("FILES")}>
  {#if selecting}
    <AppTopBar title={String(selected.length)}>
      {#snippet navigationIcon()}
        <TooltipIconButton
          label={t("SELECT_ALL")}
          onclick={() => (selected = allSelected ? [] : entries.map((entry) => entry.name))}
        >
          <SelectionDot selected={allSelected} />
        </TooltipIconButton>
      {/snippet}
      {#snippet actions()}
        <TooltipIconButton label={t("CANCEL")} onclick={exitSelection}>
          <X size={20} />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>
  {:else}
    <AppTopBar title={t("FILES")} subtitle={environment?.name ?? null}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={goUp}>
          <ArrowLeft size={20} />
        </TooltipIconButton>
      {/snippet}
      {#snippet actions()}
        <UploadIndicator />
        {#if archive === null}
          <TooltipIconButton
            label={t("SEARCH")}
            onclick={() => {
              searching = !searching;
              if (!searching) searchQuery = "";
            }}
          >
            <Search size={20} class={searching ? "text-accent" : ""} />
          </TooltipIconButton>
        {/if}
        <TooltipIconButton label={t("ENVIRONMENT")} onclick={() => (envOpen = true)}>
          <Server size={20} />
        </TooltipIconButton>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8 [&_svg]:size-6"
            aria-label={t("MORE_OPTIONS")}
          >
            <EllipsisVertical size={20} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              class="menu-surface z-50 min-w-48 rounded-md border border-outline-variant bg-surface-variant p-1 shadow-lg"
            >
              {#each SORT_KEYS as key (key)}
                <MenuItem text={t(SORT_LABELS[key])} selected={key === sortField} onclick={() => setSort(key)}>
                  {#snippet trailing()}
                    {#if key === sortField}
                      {#if sortAscending}
                        <ArrowUp size={16} class="text-accent" />
                      {:else}
                        <ArrowDown size={16} class="text-accent" />
                      {/if}
                    {/if}
                  {/snippet}
                </MenuItem>
              {/each}
              {#if archive === null}
                <MenuItem text={t("NEW_FOLDER")} onclick={() => (creatingFolder = true)}>
                  {#snippet leading()}
                    <FolderPlus size={16} class="shrink-0 text-on-surface-variant" />
                  {/snippet}
                </MenuItem>
              {/if}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      {/snippet}
    </AppTopBar>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative flex min-h-0 flex-1 flex-col {dropOver ? 'drop-ring' : ''}"
    ondragover={(event) => {
      event.preventDefault();
      dropOver = archive === null;
    }}
    ondragleave={(event) => {
      if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) dropOver = false;
    }}
    ondrop={onDrop}
  >
  {#if searching}
    <div class="px-3 py-2">
      <div class="flex h-11 items-center gap-2.5 rounded-full bg-surface-variant pr-3 pl-3.5">
        <Search size={18} class="shrink-0 text-on-surface-variant" />
        <input
          value={searchQuery}
          oninput={(event) => (searchQuery = (event.currentTarget as HTMLInputElement).value)}
          placeholder={t("SEARCH")}
          class="min-w-0 flex-1 bg-transparent text-body-md caret-accent outline-none placeholder:text-on-surface-variant"
        />
        {#if searchQuery}
          <button
            type="button"
            onclick={() => (searchQuery = "")}
            aria-label={t("CLEAR")}
            class="shrink-0 cursor-pointer text-on-surface-variant"
          >
            <X size={18} />
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <Breadcrumb
      path={archive === null ? path : [archive, archiveDir].filter(Boolean).join("/")}
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
  {/if}

  <div class="relative min-h-0 flex-1">
    {#if ordered.length}
      <div class="h-full overflow-y-auto">
        {#each ordered as entry (entry.name)}
          {@const isSelected = selected.includes(entry.name)}
          <ListRow
            icon={entry.isDir ? Folder : isArchive(entry.name) ? FolderArchive : FileIcon}
            title={entry.name}
            subtitle={formatDayTime(entry.modified * MILLIS_PER_SECOND)}
            class={dropTarget === entry.name ? "bg-accent/15" : ""}
            draggable={archive === null}
            ondragstart={() => {
              dragging = selected.includes(entry.name)
                ? selectedEntries.map((item) => child(item.name))
                : [child(entry.name)];
            }}
            ondragend={() => {
              dragging = null;
              dropTarget = null;
            }}
            ondragover={() => {
              if (entry.isDir && dragging && !dragging.includes(child(entry.name))) dropTarget = entry.name;
            }}
            ondragleave={() => {
              if (dropTarget === entry.name) dropTarget = null;
            }}
            ondrop={() => {
              const sources = dragging;
              dropTarget = null;
              dragging = null;
              if (!entry.isDir || !sources?.length) return;
              void sharedApi.move(sources, child(entry.name)).then(reload);
            }}
            onclick={() => openEntry(entry)}
            oncontextmenu={() => {
              if (transfer) return;
              selecting = true;
              toggle(entry.name);
            }}
            onlongclick={() => {
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
        {/each}
      </div>
    {:else if !loaded}
      <CenteredProgress class="h-full" />
    {:else}
      <EmptyState text={t("NO_FILES")} class="h-full" />
    {/if}

    {#if !selecting && !transfer && archive === null}
      <button
        type="button"
        onclick={() => picker?.click()}
        aria-label={t("UPLOAD_FILES")}
        class="absolute right-4 bottom-4 inline-flex size-12 cursor-pointer items-center justify-center rounded-full bg-on-background text-background shadow-lg transition-opacity hover:opacity-90"
      >
        <Plus size={24} />
      </button>
    {/if}
  </div>

  {#if transfer}
    <div transition:slide={{ duration: SLIDE_MS }} class="flex gap-3 bg-surface px-4 py-2.5">
      <Button onclick={() => (transfer = null)} variant="outlined" class="flex-1">{t("CANCEL")}</Button>
      <Button onclick={() => void runTransfer()} variant="filled" enabled={transferAllowed} class="flex-1">
        {transfer.kind === "move" ? t("MOVE_HERE") : transfer.kind === "copy" ? t("COPY_HERE") : t("EXTRACT_HERE")}
      </Button>
    </div>
  {:else if selecting && selected.length && archive !== null}
    {@const current = archive}
    <div transition:slide={{ duration: SLIDE_MS }} class="flex items-center bg-surface py-1">
      <ToolbarAction
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
    <div transition:slide={{ duration: SLIDE_MS }} class="flex items-center bg-surface py-1">
      <ToolbarAction icon={FolderInput} label={t("MOVE")} onclick={() => startTransfer("move")} />
      <ToolbarAction icon={Copy} label={t("COPY")} onclick={() => startTransfer("copy")} />
      <ToolbarAction
        icon={Share2}
        label={t("SHARE")}
        enabled={canShare}
        onclick={() => {
          selectedEntries.forEach((entry) =>
            void openSharedExternally(downloadUrl(child(entry.name)), entry.name),
          );
          exitSelection();
        }}
      />
      <ToolbarAction icon={Trash} label={t("DELETE")} onclick={() => (confirmingDelete = true)} />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class="flex min-w-0 flex-1 cursor-pointer flex-col items-center rounded-md py-2 transition-colors hover:bg-on-surface/6"
          aria-label={t("MORE")}
        >
          <EllipsisVertical size={22} />
          <span class="mt-0.5 max-w-full truncate px-1 text-label-md">{t("MORE")}</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="end"
            sideOffset={4}
            class="menu-surface z-50 min-w-48 rounded-md border border-outline-variant bg-surface-variant p-1 shadow-lg"
          >
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
                  <Eye size={16} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
            {#if single}
              <MenuItem text={t("RENAME")} onclick={() => (renaming = single)}>
                {#snippet leading()}
                  <Pencil size={16} class="shrink-0 text-on-surface-variant" />
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
                  <Download size={16} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
              <MenuItem
                text={t("SAVE_AS")}
                onclick={() => {
                  selectedEntries.forEach((entry) =>
                    void saveSharedAs(downloadUrl(child(entry.name)), entry.name),
                  );
                  exitSelection();
                }}
              >
                {#snippet leading()}
                  <Save size={16} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
            <MenuItem
              text={t("COPY_PATH")}
              onclick={() => {
                void sharedApi
                  .absolutePaths(selectedEntries.map((entry) => child(entry.name)))
                  .then((paths) => paths && navigator.clipboard.writeText(paths.join("\n")));
                exitSelection();
              }}
            >
              {#snippet leading()}
                <ClipboardCopy size={16} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            <MenuItem
              text={t("COMPRESS")}
              onclick={() => (compressing = selectedEntries.map((entry) => child(entry.name)))}
            >
              {#snippet leading()}
                <FolderArchive size={16} class="shrink-0 text-on-surface-variant" />
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
                  <PackageOpen size={16} class="shrink-0 text-on-surface-variant" />
                {/snippet}
              </MenuItem>
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  {/if}
  </div>
</div>

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

{#if envOpen}
  <SelectDialog
    title={t("ENVIRONMENT")}
    options={backend.environments.map((profile) => ({
      value: profile.id,
      label: profile.name,
      subtitle: address(profile),
    }))}
    selected={backend.activeId ?? ""}
    onSelect={(id) => backend.select(id)}
    onDismiss={() => (envOpen = false)}
  />
{/if}

{#if pendingUploads.length}
  {@const files = pendingUploads}
  <ConfirmDialog
    title={t("UPLOAD_FILES")}
    text={plural("UPLOAD_CONFIRM", files.length)}
    confirmLabel={t("UPLOAD")}
    onConfirm={() => {
      files.forEach((file) => uploads.enqueue(file, path));
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

