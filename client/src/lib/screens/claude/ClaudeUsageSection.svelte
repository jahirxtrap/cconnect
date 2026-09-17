<script lang="ts">
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { joined } from "$lib/data/format";
  import { formatDayTime, parseIsoMillis } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";

  interface Props {
    tick?: number;
    pending: string;
  }

  const { tick = 0, pending }: Props = $props();

  const MILLIS_PER_HOUR = 3_600_000;
  const MILLIS_PER_MINUTE = 60_000;
  const HOURS_PER_DAY = 24;

  const usage = $derived(claudeStatus.usage);
  const accounts = $derived(claudeStatus.accounts);
  const loading = $derived(claudeStatus.usageLoading);

  const usageWindowLabel = (id: string) =>
    id === "session" ? t("USAGE_SESSION") : id === "weekly_all" ? t("USAGE_ALL_MODELS") : id;

  const resetsLabel = (resetsAt: string | null) => {
    const millis = resetsAt === null ? null : parseIsoMillis(resetsAt);
    if (millis === null) return "—";
    const remaining = millis - Date.now();
    if (remaining <= 0) return "—";
    if (remaining < HOURS_PER_DAY * MILLIS_PER_HOUR) {
      const hours = Math.floor(remaining / MILLIS_PER_HOUR);
      const minutes = Math.floor((remaining % MILLIS_PER_HOUR) / MILLIS_PER_MINUTE);
      return t("RESETS_IN", hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
    }
    return t("RESETS_ON", formatDayTime(millis));
  };

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
      <LoadingIndicator size={20} />
    {:else if label}
      <p class="text-label-lg text-on-surface-variant">{label}</p>
    {/if}
  {/snippet}
  {#if loading}
    <EmptyState text={t("LOADING")} />
  {:else if !usage || usage.error !== null || !usage.windows.length}
    <EmptyState text={usage?.error || pending} />
  {:else}
    <div class="flex flex-col gap-3.5 p-4">
      {#each usage.windows as window (window.id)}
        <MetricBar
          title={usageWindowLabel(window.id)}
          subtitle={window.unused ? t("USAGE_UNUSED") : resetsLabel(window.resetsAt)}
          percent={window.percent}
        />
      {/each}
    </div>
  {/if}
</SettingsGroup>
