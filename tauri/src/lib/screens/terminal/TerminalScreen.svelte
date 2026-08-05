<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import CirclePlus from "@lucide/svelte/icons/circle-plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import Trash from "@lucide/svelte/icons/trash";
  import { navigation } from "$lib/app/navigation.svelte";
  import { sshAddress, sshStore, type SshProfile } from "$lib/data/sshStore.svelte";
  import { osColor, osIconPath } from "$lib/design/osIcons";
  import { t } from "$lib/i18n/index.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import SshEditDialog from "./SshEditDialog.svelte";
  import TerminalSession from "./TerminalSession.svelte";

  let active = $state<SshProfile | null>(null);
  let editing = $state<SshProfile | null>(null);
  let adding = $state(false);
  let deleting = $state<SshProfile | null>(null);
</script>

{#if active}
  <TerminalSession profile={active} onClose={() => (active = null)} />
{:else}
  <div class="flex h-full flex-col">
    <AppTopBar title={t("SSH_HOSTS")}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
          <ArrowLeft size={20} />
        </TooltipIconButton>
      {/snippet}
      {#snippet actions()}
        <TooltipIconButton label={t("ADD_SSH_HOST")} onclick={() => (adding = true)}>
          <CirclePlus size={20} />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>

    {#if !sshStore.profiles.length}
      <EmptyState text={t("NO_HOSTS")} class="flex-1" />
    {:else}
      <div class="min-h-0 flex-1 overflow-y-auto">
        {#each sshStore.profiles as profile (profile.id)}
          {@const path = osIconPath(profile.os)}
          <ListRow
            icon={path ? undefined : SquareTerminal}
            title={profile.name || profile.host}
            subtitle={sshAddress(profile)}
            onclick={() => (active = profile)}
          >
            {#snippet leading()}
              {#if path}
                <svg
                  viewBox="0 0 24 24"
                  class="size-6 shrink-0"
                  style={osColor(profile.os) ? `color: ${osColor(profile.os)}` : "color: var(--color-accent)"}
                  aria-hidden="true"
                >
                  <path d={path} fill="currentColor" />
                </svg>
              {/if}
            {/snippet}
            {#snippet trailing()}
              <TooltipIconButton label={t("EDIT_SSH_HOST")} onclick={() => (editing = profile)} class="[&_svg]:size-[22px]">
                <Pencil size={20} />
              </TooltipIconButton>
              <TooltipIconButton label={t("DELETE")} onclick={() => (deleting = profile)} class="[&_svg]:size-[22px]">
                <Trash size={20} />
              </TooltipIconButton>
            {/snippet}
          </ListRow>
        {/each}
      </div>
    {/if}
  </div>
{/if}

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
    onConfirm={() => {
      sshStore.remove(profile.id);
      deleting = null;
    }}
    onDismiss={() => (deleting = null)}
  />
{/if}
