<script lang="ts" module>
  import type { ProjectDiff } from "$lib/services/projectFilesApi";

  export interface DiffCounts {
    added: number;
    removed: number;
  }

  export const diffCounts = (diff: ProjectDiff | null): DiffCounts | null => {
    if (!diff) return null;
    const added = diff.added.length;
    const removed = Object.values(diff.removed).reduce((total, lines) => total + lines.length, 0);
    return added || removed ? { added, removed } : null;
  };
</script>

<script lang="ts">
  import AtSign from "@lucide/svelte/icons/at-sign";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import FileDiff from "@lucide/svelte/icons/file-diff";
  import Link2 from "@lucide/svelte/icons/link-2";
  import { projectFilePath } from "$lib/data/models";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { copyText } from "$lib/platform/clipboard";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import FilePreview from "$lib/screens/shared/FilePreview.svelte";
  import { projectFileUrl } from "$lib/services/projectFilesApi";
  import { sharedApi } from "$lib/services/sharedApi";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { projectDiffs } from "./projectDiffs.svelte";

  interface Props {
    projectKey: string;
    path: string;
    status: string;
    root: string | null;
    embedded?: boolean;
    onClose: () => void;
    onExpand?: (() => void) | null;
  }

  const {
    projectKey,
    path,
    status,
    root,
    embedded = false,
    onClose,
    onExpand = null,
  }: Props = $props();

  let showDiff = $state(settings.projectDiff);
  let anchorAt = $state<number | null>(null);

  const fileDiff = $derived(showDiff ? projectDiffs.get(projectKey, path) : null);
  const revision = $derived(projectDiffs.revision(projectKey, path));
  const counts = $derived(diffCounts(projectDiffs.get(projectKey, path)));

  const modified = $derived(status !== "");
  const wholeFile = $derived(status.startsWith("?") || status.includes("D"));
  const absolute = $derived(projectFilePath(root, path));

  const anchors = $derived.by(() => {
    if (!showDiff || !fileDiff || wholeFile) return [];
    const starts = new Set(Object.keys(fileDiff.removed).map(Number));
    let previous = -1;
    for (const line of [...fileDiff.added].sort((first, second) => first - second)) {
      if (line !== previous + 1) starts.add(line);
      previous = line;
    }
    return [...starts].sort((first, second) => first - second);
  });

  const anchor = $derived(anchorAt === null ? null : (anchors[anchorAt] ?? null));

  const ready = $derived(!showDiff || projectDiffs.has(projectKey, path));

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

  const mention = () => {
    const chat = tabs.state;
    chat.draft = chat.draft ? `${chat.draft} @${absolute}` : `@${absolute}`;
  };

  $effect(() => {
    void path;
    anchorAt = null;
  });

  $effect(() => {
    void projectDiffs.revision(projectKey, path);
    if (showDiff) void projectDiffs.load(projectKey, path);
  });
</script>

{#snippet diffToggle(lined: boolean)}
  {#if counts}
    <span class="flex shrink-0 items-center gap-2 px-1 font-mono text-caption">
      {#if counts.added}<span class="text-green">+{counts.added}</span>{/if}
      {#if counts.removed}<span class="text-red">-{counts.removed}</span>{/if}
    </span>
  {/if}
  {#if lined && anchors.length}
    <TooltipIconButton
      label={t("PREVIOUS_CHANGE")}
      enabled={anchorAt !== null && anchorAt > 0}
      onclick={() => step(-1)}
    >
      <ChevronUp />
    </TooltipIconButton>
    <TooltipIconButton
      label={t("NEXT_CHANGE")}
      enabled={anchorAt === null || anchorAt < anchors.length - 1}
      onclick={() => step(1)}
    >
      <ChevronDown />
    </TooltipIconButton>
  {/if}
  <TooltipIconButton
    label={t("DIFF")}
    active={showDiff}
    onclick={() => {
      showDiff = !showDiff;
      settings.projectDiff = showDiff;
    }}
  >
    <FileDiff />
  </TooltipIconButton>
{/snippet}

{#snippet fileMenu()}
  <MenuItem icon={AtSign} text={t("MENTION_IN_CHAT")} onclick={mention} />
  <MenuItem icon={Link2} text={t("LINK_TO_SHARED")} onclick={() => void sharedApi.link(absolute, projectKey)} />
{/snippet}

<FilePreview
  url={projectFileUrl(projectKey, path)}
  filename={path.split("/").at(-1) ?? path}
  {embedded}
  menuItems={fileMenu}
  onCopyPath={() => void copyText(absolute)}
  actions={modified ? diffToggle : undefined}
  added={showDiff ? (fileDiff?.added ?? []) : []}
  removed={showDiff ? (fileDiff?.removed ?? {}) : {}}
  {current}
  {anchor}
  {ready}
  {revision}
  {onExpand}
  {onClose}
/>
