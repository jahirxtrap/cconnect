<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Network from "@lucide/svelte/icons/network";
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Trash from "@lucide/svelte/icons/trash";
  import { sshAddress, sshStore, type SshProfile } from "$lib/data/sshStore.svelte";
  import { osIcon } from "$lib/design/osIcons";
  import { t } from "$lib/i18n/index.svelte";
  import PaneHeader from "$lib/screens/chat/PaneHeader.svelte";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import SshEditDialog from "./SshEditDialog.svelte";

  interface Props {
    onSelect: (profile: SshProfile) => void;
    onBack: () => void;
  }

  const { onSelect, onBack }: Props = $props();

  const compact = inPane();

  let editing = $state<SshProfile | null>(null);
  let adding = $state(false);
  let deleting = $state<SshProfile | null>(null);
</script>

{#snippet addAction()}
  <TooltipIconButton label={t("ADD_SSH_HOST")} onclick={() => (adding = true)}>
    <Plus />
  </TooltipIconButton>
{/snippet}

<div class="flex h-full flex-col bg-background">
  {#if compact}
    <PaneHeader title={t("SSH_HOSTS")} {onBack} actions={addAction} />
  {:else}
    <AppTopBar title={t("SSH_HOSTS")}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={onBack}>
          <ArrowLeft />
        </TooltipIconButton>
      {/snippet}
      {#snippet actions()}
        {@render addAction()}
      {/snippet}
    </AppTopBar>
  {/if}

  {#if !sshStore.profiles.length}
    <EmptyState icon={Network} text={t("NO_HOSTS")} class="flex-1">
      {#snippet action()}
        <Button small onclick={() => (adding = true)}>
          <Plus size={16} />
          {t("ADD_SSH_HOST")}
        </Button>
      {/snippet}
    </EmptyState>
  {:else}
    <div use:viewportScrollbar class="rounded-viewport min-h-0 flex-1 overflow-y-auto px-(--page-inset) pb-(--page-inset)">
      <div class="flex flex-col rounded-lg bg-card p-1">
        {#each sshStore.profiles as profile (profile.id)}
          {@const OsIcon = osIcon(profile.os)}
          <ListRow
            title={profile.name || profile.host}
            subtitle={sshAddress(profile)}
            onclick={() => onSelect(profile)}
          >
            {#snippet leading()}
              {#if OsIcon}
                <OsIcon class="size-4.5 shrink-0" aria-hidden="true" />
              {:else}
                <SquareTerminal size={18} class="shrink-0 text-on-surface-variant" />
              {/if}
            {/snippet}
            {#snippet trailing()}
              <TooltipIconButton label={t("EDIT_SSH_HOST")} onclick={() => (editing = profile)}>
                <Pencil />
              </TooltipIconButton>
              <TooltipIconButton label={t("DELETE")} onclick={() => (deleting = profile)}>
                <Trash />
              </TooltipIconButton>
            {/snippet}
          </ListRow>
        {/each}
      </div>
    </div>
  {/if}
</div>

{#if adding}
  <SshEditDialog
    initial={null}
    onConfirm={(profile) => {
      sshStore.upsert(profile);
      adding = false;
    }}
    onDismiss={() => (adding = false)}
  />
{/if}

{#if editing}
  <SshEditDialog
    initial={editing}
    onConfirm={(profile) => {
      sshStore.upsert(profile);
      editing = null;
    }}
    onDismiss={() => (editing = null)}
  />
{/if}

{#if deleting}
  {@const profile = deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_SSH_HOST_CONFIRM", profile.name || profile.host)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => {
      sshStore.remove(profile.id);
      deleting = null;
    }}
    onDismiss={() => (deleting = null)}
  />
{/if}
