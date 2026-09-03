<script lang="ts">
  import CornerLeftUp from "@lucide/svelte/icons/corner-left-up";
  import { untrack } from "svelte";
  import FileIcon from "@lucide/svelte/icons/file";
  import Folder from "@lucide/svelte/icons/folder";
  import HardDrive from "@lucide/svelte/icons/hard-drive";
  import Monitor from "@lucide/svelte/icons/monitor";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import { systemApi, type DirListing } from "$lib/services/systemApi";
  import Button from "./Button.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import CenteredProgress from "./CenteredProgress.svelte";
  import EmptyState from "./EmptyState.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import Pressable from "./Pressable.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";
  import { pickPath } from "./pathPicker.svelte";

  interface Props {
    mode?: "dir" | "file";
    start?: string;
    onConfirm: (path: string) => void;
    onDismiss: () => void;
  }

  const { mode = "dir", start = "", onConfirm, onDismiss }: Props = $props();

  const local = async () => {
    const selected = await pickPath(mode);
    if (selected && selected !== "fallback") onConfirm(selected);
  };

  let listing = $state<DirListing | null>(null);
  let loading = $state(true);
  let picked = $state<string | null>(null);

  const open = async (path: string) => {
    loading = true;
    const next = await systemApi.dirs(path, mode === "file");
    if (next) listing = next;
    picked = null;
    loading = false;
  };

  void open(untrack(() => start));

  const target = $derived(mode === "file" ? picked : (listing?.path ?? null));
</script>

<CompactDialog title={t("CHOOSE")} description={listing?.path ?? ""} {onDismiss}>
  {#snippet titleTrailing()}
    {#if isTauri}
      <TooltipIconButton label={t("BROWSE")} onclick={() => void local()} class="size-8 [&_svg]:size-[18px]">
        <Monitor />
      </TooltipIconButton>
    {/if}
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => target && onConfirm(target)} enabled={!!target}>{t("CHOOSE")}</Button>
  {/snippet}
  <div class="scrollbar-thin flex h-[320px] flex-col overflow-y-auto">
    {#if loading && !listing}
      <CenteredProgress class="h-full" />
    {:else if listing}
      {@const up = listing.parent}
      {#if up}
        <Pressable onclick={() => void open(up)} class="flex items-center gap-2 rounded-item px-2 py-2">
          <CornerLeftUp size={16} class="shrink-0 text-on-surface-variant" />
          <span class="min-w-0 flex-1 truncate text-body-md">..</span>
        </Pressable>
      {/if}
      {#each listing.roots as root (root)}
        <Pressable onclick={() => void open(root)} class="flex items-center gap-2 rounded-item px-2 py-2">
          <HardDrive size={16} class="shrink-0 text-on-surface-variant" />
          <span class="min-w-0 flex-1 truncate text-body-md">{root}</span>
        </Pressable>
      {/each}
      {#each listing.entries as entry (entry.path)}
        <Pressable
          onclick={() => (entry.isDir ? void open(entry.path) : (picked = entry.path))}
          class="flex items-center gap-2 rounded-item px-2 py-2 {picked === entry.path ? 'bg-accent/14' : ''}"
        >
          {#if entry.isDir}
            <Folder size={16} class="shrink-0 text-accent" />
          {:else}
            <FileIcon size={16} class="shrink-0 text-on-surface-variant" />
          {/if}
          <span class="min-w-0 flex-1 truncate text-body-md">{entry.name}</span>
        </Pressable>
      {/each}
    {:else}
      <EmptyState
        text={serverStatus.unavailable ? t("SERVER_UNAVAILABLE") : t("CONNECTION_ERROR")}
        class="h-full"
      />
    {/if}
  </div>
</CompactDialog>
