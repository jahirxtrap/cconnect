<script lang="ts">
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import type { AccountOption } from "$lib/services/capabilitiesApi";
  import { delegatesApi, type Delegate, type DelegatePreset } from "$lib/services/delegatesApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import DelegateDialog from "./DelegateDialog.svelte";
  import { DELEGATE_KIND_LABELS } from "./settingsValues";

  interface Props {
    accounts: AccountOption[];
    onDismiss: () => void;
  }

  const { accounts, onDismiss }: Props = $props();

  let delegates = $state<Delegate[] | null>(null);
  let presets = $state<DelegatePreset[]>([]);
  let error = $state<string | null>(null);
  let editing = $state<Delegate | null>(null);
  let isNew = $state(false);
  let deleting = $state<Delegate | null>(null);

  const blank = (): Delegate => ({
    id: crypto.randomUUID().slice(0, 8),
    name: "",
    kind: "model",
    description: "",
    account: null,
    command: null,
    args: [],
    editArgs: [],
    bypassArgs: [],
    enabled: true,
  });

  const store = async (next: Delegate[]) => {
    const saved = await delegatesApi.save(next);
    if (saved) {
      delegates = saved;
      error = null;
    } else error = t("CONNECTION_ERROR");
  };

  const upsert = (delegate: Delegate) => {
    const list = delegates ?? [];
    void store(list.some((item) => item.id === delegate.id) ? list.map((item) => (item.id === delegate.id ? delegate : item)) : [...list, delegate]);
    editing = null;
  };

  const edit = (delegate: Delegate) => {
    editing = { ...delegate };
    isNew = false;
  };

  const remove = (delegate: Delegate) => {
    void store((delegates ?? []).filter((item) => item.id !== delegate.id));
    deleting = null;
  };

  $effect(() => {
    void delegatesApi.list().then((found) => {
      if (!found) {
        error = t("CONNECTION_ERROR");
        return;
      }
      delegates = found.delegates;
      presets = found.presets;
    });
  });
</script>

<CompactDialog title={t("DELEGATES")} description={t("DELEGATES_SUMMARY")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  {#if error}
    <p class="text-body-sm wrap-anywhere text-error">{error}</p>
  {/if}
  {#if !delegates}
    {#if !error}
      <CenteredProgress class="py-6" />
    {/if}
  {:else if delegates.length}
    {#each delegates as delegate (delegate.id)}
      <ListRow
        title={delegate.name}
        subtitle={joined(t(delegate.enabled ? "OPTION_ON" : "OPTION_OFF"), t(DELEGATE_KIND_LABELS[delegate.kind]))}
        onclick={() => edit(delegate)}
      >
        {#snippet trailing()}
          <TooltipIconButton label={t("DELETE")} onclick={() => (deleting = delegate)}>
            <Trash2 />
          </TooltipIconButton>
        {/snippet}
      </ListRow>
    {/each}
  {:else}
    <EmptyState text={t("NO_DELEGATES")} />
  {/if}
  {#if delegates}
    <div class="mt-2">
      <ActionButton
        text={t("ADD_DELEGATE")}
        onclick={() => {
          editing = blank();
          isNew = true;
        }}
        class="w-full"
      />
    </div>
  {/if}
</CompactDialog>

{#if editing}
  {@const delegate = editing}
  <DelegateDialog {delegate} {isNew} {presets} {accounts} onSave={upsert} onDismiss={() => (editing = null)} />
{/if}

{#if deleting}
  {@const delegate = deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_DELEGATE_CONFIRM", delegate.name)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => remove(delegate)}
    onDismiss={() => (deleting = null)}
  />
{/if}
