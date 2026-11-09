<script lang="ts">
  import CircleX from "@lucide/svelte/icons/circle-x";
  import type { Snippet } from "svelte";
  import { formatDuration } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import { toolIcon } from "$lib/ui/toolIcons";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    name: string | null;
    mcp?: boolean;
    input: string;
    result: string | null;
    running: boolean;
    took?: number | null;
    failed?: boolean;
    blockedBy?: string | null;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    resultView?: Snippet<[string]>;
  }

  const {
    name,
    mcp = false,
    input,
    result,
    running,
    took = null,
    failed = false,
    blockedBy = null,
    expanded = null,
    onToggle = null,
    resultView,
  }: Props = $props();

  const SLOW_MS = 1000;
  const FIELD_PREFIX = /^([\w-]+):\s*/;
  const PATH_FIELDS = new Set(["file_path", "path", "notebook_path"]);

  const firstLine = $derived(input.split("\n").find((line) => line.trim()) ?? "");
  const headline = $derived(firstLine.replace(FIELD_PREFIX, ""));
  const headlinePath = $derived(PATH_FIELDS.has(firstLine.match(FIELD_PREFIX)?.[1] ?? ""));

  const empty = $derived(!input.trim() && !result?.trim());
  const elapsed = $derived(took !== null && took >= SLOW_MS ? formatDuration(took) : null);
  const blockedText = $derived(
    [`**${t("HOOK_BLOCKED", blockedBy ?? "")}**`, result?.trim()].filter(Boolean).join("\n\n"),
  );
</script>

<Collapsible
  label={name ?? t("TOOLS")}
  icon={toolIcon(name, mcp)}
  preview={headline}
  previewTail={headlinePath}
  stat={running ? null : elapsed}
  meta={failed ? failedMark : undefined}
  labelOnly={empty}
  {running}
  {expanded}
  {onToggle}
>
  {#if input.trim()}
    <p class="font-mono text-body-sm wrap-anywhere whitespace-pre-wrap text-on-surface-variant">{input}</p>
  {/if}
  {#if blockedBy}
    <div class="mt-1.5">
      <MarkdownText text={blockedText} dense class="text-on-surface-variant" />
    </div>
  {:else if result?.trim()}
    <div class="mt-1.5">
      {#if resultView}
        {@render resultView(result)}
      {:else}
        <CodeBlock code={result} lang={t("RESULT")} />
      {/if}
    </div>
  {/if}
</Collapsible>

{#snippet failedMark()}
  <CircleX size={14} class="text-red" role="img" aria-label={t("TOOL_FAILED")} />
{/snippet}
