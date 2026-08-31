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

  const toggle = (name: string, enabled: boolean) => {
    const next = new Set(hidden);
    if (enabled) next.delete(name);
    else next.add(name);
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
    {#each tools as tool (tool.name)}
      <SwitchRow
        title={tool.name}
        summary={tool.description || null}
        checked={!hidden.has(tool.name)}
        onChange={(value) => toggle(tool.name, value)}
      />
    {/each}
  {:else}
    <EmptyState text={t("MCP_TOOLS_EMPTY")} class="py-6" />
  {/if}
</CompactDialog>
