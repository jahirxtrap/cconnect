<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Lock from "@lucide/svelte/icons/lock";
  import LockOpen from "@lucide/svelte/icons/lock-open";
  import Pencil from "@lucide/svelte/icons/pencil";
  import QrCode from "@lucide/svelte/icons/qr-code";
  import ScanQrCode from "@lucide/svelte/icons/scan-qr-code";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { environmentQr, parseEnvironmentQr } from "$lib/data/qrPayload";
  import { qrScanAvailable, scanQr } from "$lib/services/qrScanner.svelte";
  import { panes } from "$lib/screens/chat/panes.svelte";
  import {
    address,
    addressFields,
    authFields,
    backend,
    blankEnvironment,
    type EnvironmentProfile,
  } from "$lib/services/backend.svelte";
  import { isLoopback } from "$lib/services/localServer.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import QrDialog from "$lib/ui/QrDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import EnvironmentDialog from "./EnvironmentDialog.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const qrAvailable = qrScanAvailable();

  const startScan = async () => {
    const raw = await scanQr();
    if (raw) applyQr(raw);
  };

  const applyQr = (raw: string) => {
    const scanned = parseEnvironmentQr(raw);
    if (!scanned) return;
    editing = { ...blankEnvironment(), ...addressFields(scanned.address), ...authFields(scanned.auth), name: scanned.name };
    isNew = true;
  };

  let editing = $state<EnvironmentProfile | null>(null);
  let isNew = $state(false);
  let deleting = $state<EnvironmentProfile | null>(null);
  let sharing = $state<EnvironmentProfile | null>(null);
  let menuId = $state<string | null>(null);

  const save = (profile: EnvironmentProfile) => {
    const known = backend.environments.some((item) => item.id === profile.id);
    backend.save(
      known ? backend.environments.map((item) => (item.id === profile.id ? profile : item)) : [...backend.environments, profile],
    );
    if (!backend.activeId) backend.select(profile.id);
    editing = null;
  };

  const choose = (id: string) => panes.focusedChat.selectEnvironment(id);

  const remove = (profile: EnvironmentProfile) => {
    const left = backend.environments.filter((item) => item.id !== profile.id);
    backend.save(left);
    if (backend.activeId === profile.id) {
      if (left[0]) choose(left[0].id);
      else backend.select("");
    }
    deleting = null;
  };
</script>

<CompactDialog title={t("ENVIRONMENTS")} {onDismiss}>
  {#snippet titleTrailing()}
    {#if qrAvailable}
      <TooltipIconButton
        label={t("SCAN_QR")}
        onclick={() => void startScan()}
      >
        <ScanQrCode />
      </TooltipIconButton>
    {/if}
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}

  {#if backend.environments.length}
    {#each backend.environments as profile (profile.id)}
      <DialogSelectItem
        label={profile.name}
        subtitle={address(profile)}
        selected={profile.id === backend.active?.id}
        onclick={() => choose(profile.id)}
      >
        {#snippet trailing()}
          {#if profile.id === backend.active?.id}
            <TooltipIconButton
              label={settings.environmentLocked ? t("UNLOCK_SELECTION") : t("LOCK_SELECTION")}
              onclick={() => (settings.environmentLocked = !settings.environmentLocked)}
            >
              {#if settings.environmentLocked}
                <Lock class="text-accent" />
              {:else}
                <LockOpen />
              {/if}
            </TooltipIconButton>
          {/if}
          <PopupMenu
            open={menuId === profile.id}
            onOpenChange={(open) => (menuId = open ? profile.id : null)}
            label={t("MORE_OPTIONS")}
            align="end"
          >
            {#snippet triggerChild(props)}
              <TooltipIconButton label={t("MORE_OPTIONS")} tooltip={false} {...props}>
                <EllipsisVertical />
              </TooltipIconButton>
            {/snippet}
            <MenuItem
              icon={Pencil}
              text={t("EDIT_ENVIRONMENT")}
              onclick={() => {
                editing = { ...profile };
                isNew = false;
              }}
            />
            {#if !isLoopback(profile)}
              <MenuItem icon={QrCode} text={t("SHOW_QR")} onclick={() => (sharing = profile)} />
            {/if}
            <MenuItem icon={Trash2} danger text={t("DELETE")} onclick={() => (deleting = profile)} />
          </PopupMenu>
        {/snippet}
      </DialogSelectItem>
    {/each}
  {:else}
    <EmptyState text={t("NO_ENVIRONMENTS")} />
  {/if}
  <div class="mt-2">
    <ActionButton
      text={t("ADD_ENVIRONMENT")}
      onclick={() => {
        editing = blankEnvironment();
        isNew = true;
      }}
      class="w-full"
    />
  </div>
</CompactDialog>

{#if editing}
  {@const profile = editing}
  <EnvironmentDialog
    {profile}
    {isNew}
    isActive={!isNew && profile.id === backend.activeId}
    onSave={save}
    onDismiss={() => (editing = null)}
  />
{/if}

{#if sharing}
  {@const profile = sharing}
  <QrDialog
    title={profile.name}
    choices={[{ label: t("ENVIRONMENT"), text: environmentQr(profile), hint: t("QR_ENVIRONMENT_HINT") }]}
    onDismiss={() => (sharing = null)}
  />
{/if}

{#if deleting}
  {@const profile = deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_ENVIRONMENT_CONFIRM", profile.name)}
    confirmLabel={t("DELETE")}
    danger
    onConfirm={() => remove(profile)}
    onDismiss={() => (deleting = null)}
  />
{/if}
