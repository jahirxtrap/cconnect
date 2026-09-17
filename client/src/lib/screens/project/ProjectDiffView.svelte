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
  import FilePreview, { type ToolbarButton } from "$lib/screens/shared/FilePreview.svelte";
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

{#snippet diffToggle(button: ToolbarButton, lined: boolean)}
  {#if lined && anchors.length}
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
  <MenuItem text={t("LINK_TO_SHARED")} onclick={() => void sharedApi.link(absolute, projectKey)}>
    {#snippet leading()}
      <Link2 size={20} class="shrink-0 text-on-surface-variant" />
    {/snippet}
  </MenuItem>
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
