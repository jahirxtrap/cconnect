<script lang="ts">
  import { untrack } from "svelte";
  import type { DatabaseObjectRef } from "$lib/app/viewer.svelte";
  import {
    databaseFailureText,
    type DatabaseConnection,
    type DatabaseFailure,
    type DatabaseFileSource,
  } from "$lib/data/databaseModels";
  import { KeyGate } from "$lib/data/keyGate.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { databases } from "$lib/services/databases.svelte";
  import { createDatabasesApi } from "$lib/services/databasesApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import { fileIcon } from "$lib/ui/fileIcons";
  import ScrollCard from "$lib/ui/ScrollCard.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import DatabaseObjectView from "./DatabaseObjectView.svelte";
  import DatabaseTree from "./DatabaseTree.svelte";

  interface Props {
    source: DatabaseFileSource;
    filename: string;
    embedded: boolean;
    revision: number;
    onExpand?: (() => void) | null;
  }

  const { source, filename, embedded, revision, onExpand = null }: Props = $props();

  const LIST_FRAME = "flex-1 rounded-panel";
  const NOT_A_DATABASE = "engine";
  const GONE = "missing";

  const api = createDatabasesApi(() => backend.active);
  const gate = new KeyGate();

  let connection = $state<DatabaseConnection | null>(null);
  let failure = $state<DatabaseFailure | null>(null);
  let failed = $state<string | null>(null);
  let object = $state<DatabaseObjectRef | null>(null);
  let attempt = $state(0);

  const profile = $derived(backend.active);

  $effect(() => {
    if (!databases.listOf(profile) && !serverStatus.unavailable) void databases.refresh(profile);
  });

  $effect(() => {
    const target = profile;
    const wanted = { project: source.project, path: source.path };
    void attempt;
    let active = true;
    untrack(() => {
      connection = null;
      failure = null;
      failed = null;
      object = null;
    });
    void gate.run((key) => api.openFile(wanted, key)).then((result) => {
      if (!active) return;
      if (!result.ok) {
        failure = result.failure;
        return;
      }
      databases.adoptFile(target, result.value);
      databases.forget(target, result.value.id);
      connection = result.value;
    });
    return () => {
      active = false;
    };
  });

  let seen = untrack(() => revision);

  $effect(() => {
    const next = revision;
    if (next === seen) return;
    seen = next;
    const opened = untrack(() => connection);
    if (opened) databases.forget(untrack(() => profile), opened.id);
  });
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2 px-(--page-inset) pb-(--page-inset)">
  {#if failed}
    <ErrorText text={failed} class="shrink-0 px-1" />
  {/if}
  {#if connection}
    <ScrollCard frame={LIST_FRAME} memory={`database-file|${connection.id}`}>
      <DatabaseTree
        connections={[connection]}
        rooted={false}
        selected={object}
        {gate}
        onOpen={(target) => (object = target)}
        onError={(text) => (failed = text)}
      />
    </ScrollCard>
  {:else if failure?.reason === NOT_A_DATABASE}
    <EmptyState icon={fileIcon(filename)} text={t("FILE_BINARY")} class="min-h-0 flex-1" />
  {:else if failure?.reason === GONE}
    <EmptyState icon={fileIcon(filename)} text={t("FILE_UNAVAILABLE")} class="min-h-0 flex-1" />
  {:else if failure}
    <EmptyState icon={fileIcon(filename)} text={databaseFailureText(failure)} class="min-h-0 flex-1">
      {#snippet action()}
        <ActionButton text={t("RETRY")} onclick={() => attempt++} />
      {/snippet}
    </EmptyState>
  {:else}
    <CenteredProgress class="min-h-0 flex-1" />
  {/if}
</div>

{#if object}
  <div class={embedded ? "absolute inset-0 z-10" : ""}>
    <DatabaseObjectView
      connection={object.connection}
      database={object.database}
      schema={object.schema}
      name={object.name}
      kind={object.kind}
      {embedded}
      {onExpand}
      onClose={() => (object = null)}
    />
  </div>
{/if}

{#if gate.asking}
  <SecurityKeyDialog rejected={gate.rejected} onConfirm={(key) => gate.confirm(key)} onDismiss={() => gate.dismiss()} />
{/if}
