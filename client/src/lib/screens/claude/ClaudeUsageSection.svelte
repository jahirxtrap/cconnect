<script lang="ts">
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { joined } from "$lib/data/format";
  import type { Usage } from "$lib/data/usageWindows";
  import { i18n, t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { claudeApi } from "$lib/services/claudeApi";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import UsageWindows from "./UsageWindows.svelte";

  interface Props {
    tick?: number;
    pending: string;
  }

  const { tick = 0, pending }: Props = $props();

  let picked = $state("");
  let viewed = $state<{ id: string; usage: Usage | null } | null>(null);

  const accounts = $derived(claudeStatus.accounts);
  const planned = $derived((accounts?.accounts ?? []).filter((item) => item.loggedIn && !item.provider));
  const picking = $derived(planned.length > 1);
  const account = $derived(planned.some((item) => item.id === picked) ? picked : "");
  const serverAccount = $derived(planned.find((item) => item.id === accounts?.default)?.label ?? null);
  const accountOptions = $derived([
    { value: "", label: t("SERVER_DEFAULT") },
    ...planned.map((item) => ({ value: item.id, label: item.label })),
  ]);

  const usage = $derived(account ? (viewed?.id === account ? viewed.usage : null) : claudeStatus.usage);
  const loading = $derived(account ? viewed?.id !== account : claudeStatus.usageLoading);

  const label = $derived.by(() => {
    if (picking) return usage?.plan ?? "";
    const accountLabel =
      (accounts?.accounts.length ?? 0) > 1
        ? (accounts?.accounts.find((item) => item.id === accounts?.default)?.label ?? null)
        : null;
    return joined(accountLabel, usage?.plan);
  });

  let asked: number | null = null;

  $effect(() => {
    const current = tick;
    const viewing = account;
    void backend.activeId;
    const manual = asked !== null && current !== asked;
    asked = current;
    if (!viewing) {
      void claudeStatus.loadUsage(manual);
      return;
    }
    void claudeApi.usage(i18n.resolved, viewing, manual).then((value) => {
      if (account === viewing) viewed = { id: viewing, usage: value };
    });
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
  {#if picking}
    <div class="px-4 pt-4">
      <SelectField
        label=""
        selected={account}
        options={accountOptions}
        shown={account ? null : serverAccount}
        onSelect={(value) => (picked = value)}
      />
    </div>
  {/if}
  {#if loading}
    <EmptyState text={t("LOADING")} />
  {:else if !usage || usage.error !== null || !usage.windows.length}
    <EmptyState text={usage?.error || pending} />
  {:else}
    <UsageWindows windows={usage.windows} class="p-4" />
  {/if}
</SettingsGroup>
