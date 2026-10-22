<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { pluginKey, type ClaudeApi, type Plugin } from "$lib/services/claudeApi";
  import PluginOptionsDialog from "$lib/screens/claude/PluginOptionsDialog.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";

  interface Props {
    api: ClaudeApi;
    onDismiss: () => void;
  }

  const { api, onDismiss }: Props = $props();

  let mods = $state<Plugin[] | null>(null);
  let error = $state<string | null>(null);
  let optionsFor = $state<Plugin | null>(null);
  let query = $state("");

  const matches = (plugin: Plugin) => {
    const wanted = query.trim().toLowerCase();
    return !wanted || plugin.name.toLowerCase().includes(wanted) || !!plugin.description?.toLowerCase().includes(wanted);
  };

  const shown = $derived((mods ?? []).filter(matches));

  $effect(() => {
    let live = true;
    void api.extensions().then((found) => {
      if (!live) return;
      if (found) mods = found.plugins.filter((plugin) => plugin.mod && plugin.enabled && plugin.options);
      else error = t("CONNECTION_ERROR");
    });
    return () => {
      live = false;
    };
  });
</script>

<CompactDialog title={t("MODS_OPTIONS")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  {#snippet header()}
    <SearchBar value={query} oninput={(value) => (query = value)} placeholder={t("SEARCH")} />
  {/snippet}
  {#if error}
    <p class="text-body-sm wrap-anywhere text-error">{error}</p>
  {:else if !mods}
    <CenteredProgress class="py-6" />
  {:else if !shown.length}
    <EmptyState text={t(mods.length ? "NO_RESULTS" : "NO_MODS_OPTIONS")} class="py-8" />
  {:else}
    {#each shown as plugin (pluginKey(plugin))}
      <ListRow
        class="rounded-lg"
        padding="py-2.5 pr-3 pl-3"
        subtitleLines={2}
        title={plugin.name}
        subtitle={plugin.description}
        onclick={() => (optionsFor = plugin)}
      />
    {/each}
  {/if}
</CompactDialog>

{#if optionsFor}
  {@const plugin = optionsFor}
  <PluginOptionsDialog {api} plugin={pluginKey(plugin)} title={plugin.name} onDismiss={() => (optionsFor = null)} />
{/if}
