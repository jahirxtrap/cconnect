<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import Plug from "@lucide/svelte/icons/plug";
  import Trash from "@lucide/svelte/icons/trash";
  import { databaseFailureText, engineLabel, type DatabaseEngine } from "$lib/data/databaseModels";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { databases } from "$lib/services/databases.svelte";
  import { createDatabasesApi, type DatabaseOutcome } from "$lib/services/databasesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import IconTile from "$lib/ui/IconTile.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  interface Driver {
    key: string;
    engine: DatabaseEngine;
    title: string;
    engines: string;
  }

  const api = createDatabasesApi(() => backend.active);

  let busy = $state(false);
  let failed = $state<string | null>(null);
  let removing = $state<Driver | null>(null);

  const profile = $derived(backend.active);
  const drivers = $derived.by(() => {
    const grouped = new Map<string, DatabaseEngine[]>();
    for (const engine of databases.listOf(profile)?.engines ?? []) {
      if (engine.form === "url") continue;
      const key = engine.packages.join(" ") || engine.id;
      grouped.set(key, [...(grouped.get(key) ?? []), engine]);
    }
    return [...grouped].map(([key, members]): Driver => ({
      key,
      engine: members[0],
      title: members[0].packages.join(" ") || engineLabel(members[0], members[0].id),
      engines: members[0].packages.length ? members.map((member) => engineLabel(member, member.id)).join(", ") : t("DATABASE_DRIVER_BUILTIN"),
    }));
  });
  const installed = $derived(drivers.filter((driver) => driver.engine.installed));
  const offered = $derived(drivers.filter((driver) => !driver.engine.installed));

  const act = async (action: () => Promise<DatabaseOutcome<DatabaseEngine[]>>) => {
    busy = true;
    failed = null;
    const result = await action();
    busy = false;
    if (result.ok) databases.adoptEngines(profile, result.value);
    else failed = databaseFailureText(result.failure);
  };

  const uninstall = (driver: Driver) => {
    removing = null;
    return act(() => api.uninstall(driver.engine.id));
  };
</script>

{#snippet progress()}
  <LinearProgress />
{/snippet}

{#snippet tile()}
  <IconTile icon={Plug} />
{/snippet}

<CompactDialog title={t("DATABASE_DRIVERS")} header={busy ? progress : undefined} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  <div class="flex w-full flex-col [--page-inset:0px]">
    {#if failed}
      <ErrorText text={failed} class="pb-2" />
    {/if}
    <SectionHeader label={t("DATABASE_DRIVERS_INSTALLED")} />
    {#each installed as driver (driver.key)}
      <ListRow title={driver.title} subtitle={driver.engines} subtitleLines={2} leading={tile}>
        {#snippet trailing()}
          {#if driver.engine.packages.length}
            <TooltipIconButton label={t("UNINSTALL")} enabled={!busy} onclick={() => (removing = driver)}>
              <Trash />
            </TooltipIconButton>
          {/if}
        {/snippet}
      </ListRow>
    {/each}
    <SectionHeader label={t("DATABASE_DRIVERS_AVAILABLE")} divider />
    {#each offered as driver (driver.key)}
      <ListRow title={driver.title} subtitle={driver.engines} subtitleLines={2} leading={tile}>
        {#snippet trailing()}
          <TooltipIconButton label={t("INSTALL")} enabled={!busy} onclick={() => void act(() => api.install(driver.engine.id))}>
            <Download />
          </TooltipIconButton>
        {/snippet}
      </ListRow>
    {:else}
      <EmptyState text={t("DATABASE_DRIVERS_AVAILABLE_NONE")} class="py-3" />
    {/each}
  </div>
</CompactDialog>

{#if removing}
  {@const target = removing}
  <ConfirmDialog
    title={t("UNINSTALL")}
    text={t("DATABASE_DRIVER_REMOVE_CONFIRM", target.title)}
    confirmLabel={t("UNINSTALL")}
    danger
    onConfirm={() => void uninstall(target)}
    onDismiss={() => (removing = null)}
  />
{/if}
