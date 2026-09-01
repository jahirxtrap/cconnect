<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import type { McpTool } from "$lib/services/capabilitiesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    tools: McpTool[];
    disabled: string;
    onConfirm: (disabled: string) => void;
    onDismiss: () => void;
  }

  const { tools, disabled, onConfirm, onDismiss }: Props = $props();

  let hidden = $state(
    untrack(() => new Set(disabled.split(",").map((name) => name.trim()).filter(Boolean))),
  );

  interface Entry {
    key: string;
    title: string;
    summary: string | null;
    names: string[];
  }

  const entries = $derived.by(() => {
    const list: Entry[] = [];
    const groups = new Map<string, Entry>();
    for (const tool of tools) {
      if (!tool.group) {
        list.push({ key: tool.name, title: tool.name, summary: tool.description || null, names: [tool.name] });
        continue;
      }
      const existing = groups.get(tool.group);
      if (existing) {
        existing.names.push(tool.name);
        continue;
      }
      const entry: Entry = {
        key: tool.group,
        title: tool.group,
        summary: tool.groupDescription || null,
        names: [tool.name],
      };
      groups.set(tool.group, entry);
      list.push(entry);
    }
    return list;
  });

  const toggle = (names: string[], enabled: boolean) => {
    const next = new Set(hidden);
    for (const name of names) {
      if (enabled) next.delete(name);
      else next.add(name);
    }
    hidden = next;
  };
</script>

<CompactDialog title={t("MCP_TOOLS")} onDismiss={onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm([...hidden].join(","))}>{t("SAVE")}</Button>
  {/snippet}
  {#if tools.length}
    <p class="mb-2 text-body-sm text-on-surface-variant">{t("MCP_TOOLS_DESC")}</p>
    {#each entries as entry (entry.key)}
      <SwitchRow
        title={entry.title}
        summary={entry.summary}
        checked={entry.names.some((name) => !hidden.has(name))}
        onChange={(value) => toggle(entry.names, value)}
      />
    {/each}
  {:else}
    <EmptyState text={t("MCP_TOOLS_EMPTY")} class="py-6" />
  {/if}
</CompactDialog>
