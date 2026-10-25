<script lang="ts">
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import UsageWindows from "./UsageWindows.svelte";

  interface Props {
    tick?: number;
    pending: string;
  }

  const { tick = 0, pending }: Props = $props();

  const usage = $derived(claudeStatus.usage);
  const accounts = $derived(claudeStatus.accounts);
  const loading = $derived(claudeStatus.usageLoading);

  const label = $derived.by(() => {
    const accountLabel =
      (accounts?.accounts.length ?? 0) > 1
        ? (accounts?.accounts.find((item) => item.id === accounts?.default)?.label ?? null)
        : null;
    return joined(accountLabel, usage?.plan);
  });

  let asked: number | null = null;

  $effect(() => {
    const current = tick;
    void backend.activeId;
    const manual = asked !== null && current !== asked;
    asked = current;
    void claudeStatus.loadUsage(manual);
  });
</script>

<SettingsGroup label={t("USAGE")}>
  {#snippet labelTrailing()}
    {#if loading}
      <StatusDot loading />
    {:else if label}
      <p class="text-body-sm text-on-surface-variant">{label}</p>
    {/if}
  {/snippet}
  {#if loading}
    <EmptyState text={t("LOADING")} />
  {:else if !usage || usage.error !== null || !usage.windows.length}
    <EmptyState text={usage?.error || pending} />
  {:else}
    <UsageWindows windows={usage.windows} class="p-4" />
  {/if}
</SettingsGroup>
