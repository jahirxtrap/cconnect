<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import File from "@lucide/svelte/icons/file";
  import FileLock2 from "@lucide/svelte/icons/file-lock-2";
  import LogOut from "@lucide/svelte/icons/log-out";
  import CloudDownload from "@lucide/svelte/icons/cloud-download";
  import Trash from "@lucide/svelte/icons/trash";
  import { joined } from "$lib/data/format";
  import { formatDateShort } from "$lib/data/time";
  import { plural, t } from "$lib/i18n/index.svelte";
  import type { DriveCopy } from "$lib/services/drive/driveApi";
  import { driveBackups, type UploadOptions } from "$lib/services/drive/driveBackups.svelte";
  import { googleSession } from "$lib/services/drive/googleSession.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import DriveRestoreDialog from "./DriveRestoreDialog.svelte";
  import DriveUploadDialog from "./DriveUploadDialog.svelte";

  interface Props {
    onChanged: () => void;
    onDismiss: () => void;
  }

  const { onChanged, onDismiss }: Props = $props();

  let uploading = $state(false);
  let restoring = $state<DriveCopy | null>(null);
  let rejected = $state(false);
  let deleting = $state<DriveCopy | null>(null);
  let disconnecting = $state(false);

  const linked = $derived(googleSession.connected && googleSession.ready);

  $effect(() => {
    if (linked) void driveBackups.refresh();
  });

  const summary = (copy: DriveCopy) =>
    joined(
      formatDateShort(copy.createdAt),
      plural("DRIVE_ENVIRONMENTS", copy.environments),
      plural("DRIVE_NOTES", copy.notes),
    );

  const dismiss = () => {
    if (googleSession.connecting) googleSession.cancel();
    onDismiss();
  };

  const upload = async (options: UploadOptions) => {
    uploading = false;
    await driveBackups.upload(options);
  };

  const restore = async (copy: DriveCopy, password: string) => {
    const result = await driveBackups.restore(copy, password);
    if (result === "password") {
      rejected = true;
      return;
    }
    restoring = null;
    if (result === "ok") onChanged();
  };

  const remove = async (copy: DriveCopy) => {
    deleting = null;
    await driveBackups.remove(copy);
  };

  const disconnect = async () => {
    disconnecting = false;
    await googleSession.disconnect();
    driveBackups.clear();
  };
</script>

<CompactDialog title={t("DRIVE_BACKUP")} onDismiss={dismiss}>
  {#snippet header()}
    {#if googleSession.user}
      {@const user = googleSession.user}
      <OutlinedPanel>
        <div class="flex items-center gap-3">
          {#if user.photo}
            <img
              src={user.photo}
              alt=""
              referrerpolicy="no-referrer"
              class="size-9 shrink-0 rounded-full"
            />
          {:else}
            <CircleUser size={24} class="shrink-0 text-on-surface-variant" />
          {/if}
          <div class="min-w-0 flex-1">
            <p class="truncate text-body-md">{user.name || user.email}</p>
            <p class="truncate text-body-sm text-on-surface-variant">{user.email}</p>
          </div>
          <TooltipIconButton
            label={t("DRIVE_DISCONNECT")}
            class="size-8 [&_svg]:size-[18px]"
            onclick={() => (disconnecting = true)}
          >
            <LogOut />
          </TooltipIconButton>
        </div>
      </OutlinedPanel>
    {/if}
  {/snippet}

  {#snippet buttons()}
    <Button onclick={dismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}

  {#if !linked}
    <p class="text-body-md">{t("DRIVE_CONNECT_HINT")}</p>
    <div class="mt-3">
      <ActionButton
        text={t("DRIVE_CONNECT")}
        enabled={!googleSession.connecting}
        onclick={() => void googleSession.connect()}
        class="w-full"
      />
    </div>
    {#if googleSession.connecting}
      <CenteredProgress class="h-[72px]" />
    {/if}
  {:else}
    <div class="scrollbar-thin flex max-h-[420px] flex-col gap-1 overflow-y-auto">
      {#each driveBackups.copies as copy (copy.id)}
        {@const Icon = copy.encrypted ? FileLock2 : File}
        <div
          data-press
          class="flex items-center rounded-item pr-1 transition-colors hover:bg-on-surface/8 {driveBackups.busy
            ? 'opacity-50'
            : ''}"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
            <Icon size={18} class="shrink-0 text-on-surface-variant" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-body-md">{copy.device || copy.name}</p>
              <p class="truncate text-body-sm text-on-surface-variant">{summary(copy)}</p>
            </div>
          </div>
          <TooltipIconButton
            label={t("RESTORE")}
            class="[&_svg]:size-[18px]"
            enabled={!driveBackups.busy}
            onclick={() => {
              rejected = false;
              restoring = copy;
            }}
          >
            <CloudDownload />
          </TooltipIconButton>
          <TooltipIconButton
            label={t("DELETE")}
            class="[&_svg]:size-[18px]"
            enabled={!driveBackups.busy}
            onclick={() => (deleting = copy)}
          >
            <Trash />
          </TooltipIconButton>
        </div>
      {/each}
      {#if driveBackups.loading && driveBackups.copies.length === 0}
        <CenteredProgress class="h-[72px]" />
      {:else if driveBackups.copies.length === 0}
        <p class="px-3 py-2.5 text-body-md text-on-surface-variant">{t("DRIVE_NO_COPIES")}</p>
      {/if}
    </div>
    <div class="mt-2">
      <ActionButton
        text={t("DRIVE_UPLOAD")}
        enabled={!driveBackups.busy}
        onclick={() => (uploading = true)}
        class="w-full"
      />
    </div>
    {#if driveBackups.failed}
      <p class="mt-2 text-body-sm text-red">{t("DRIVE_FAILED")}</p>
    {/if}
  {/if}
</CompactDialog>

{#if uploading}
  <DriveUploadDialog onUpload={(options) => void upload(options)} onDismiss={() => (uploading = false)} />
{/if}

{#if restoring}
  {@const copy = restoring}
  <DriveRestoreDialog
    {copy}
    {rejected}
    summary={summary(copy)}
    onConfirm={(password) => void restore(copy, password)}
    onDismiss={() => (restoring = null)}
  />
{/if}

{#if disconnecting && googleSession.user}
  {@const user = googleSession.user}
  <ConfirmDialog
    title={t("DRIVE_DISCONNECT")}
    text={t("DRIVE_DISCONNECT_CONFIRM", user.email)}
    confirmLabel={t("DRIVE_DISCONNECT")}
    onConfirm={() => void disconnect()}
    onDismiss={() => (disconnecting = false)}
  />
{/if}

{#if deleting}
  {@const copy = deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DRIVE_DELETE_CONFIRM", summary(copy))}
    confirmLabel={t("DELETE")}
    onConfirm={() => void remove(copy)}
    onDismiss={() => (deleting = null)}
  />
{/if}
