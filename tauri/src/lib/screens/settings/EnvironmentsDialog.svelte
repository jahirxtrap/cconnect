<script lang="ts">
  import Lock from "@lucide/svelte/icons/lock";
  import LockOpen from "@lucide/svelte/icons/lock-open";
  import Pencil from "@lucide/svelte/icons/pencil";
  import ScanQrCode from "@lucide/svelte/icons/scan-qr-code";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import { parseQrPayload } from "$lib/data/qrPayload";
  import { qrScanAvailable, scanQr } from "$lib/services/qrScanner.svelte";
  import { address, backend, type EnvironmentProfile } from "$lib/services/backend.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
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
    const payload = parseQrPayload(raw);
    if (!payload) return;
    editing = { ...blank(), host: payload.url, authKind: "bearer", authToken: payload.token };
    isNew = true;
  };

  const blank = (): EnvironmentProfile => ({
    id: crypto.randomUUID(),
    name: "",
    kind: isTauri ? "http" : "https",
    host: "",
    port: isTauri ? DEFAULT_PORT : null,
    authKind: "none",
    authToken: "",
    authUser: "",
    authPassword: "",
    authHeaderName: "",
    authHeaderValue: "",
    directory: "",
    account: "",
    model: "",
    effort: "",
    permissionMode: "",
    streaming: null,
    accentIndex: null,
  });

  const DEFAULT_PORT = 8723;

  let editing = $state<EnvironmentProfile | null>(null);
  let isNew = $state(false);
  let deleting = $state<EnvironmentProfile | null>(null);

  const save = (profile: EnvironmentProfile) => {
    const known = backend.environments.some((item) => item.id === profile.id);
    backend.save(
      known ? backend.environments.map((item) => (item.id === profile.id ? profile : item)) : [...backend.environments, profile],
    );
    if (!backend.activeId) backend.select(profile.id);
    editing = null;
  };

  const remove = (profile: EnvironmentProfile) => {
    const left = backend.environments.filter((item) => item.id !== profile.id);
    backend.save(left);
    if (backend.activeId === profile.id) backend.select(left[0]?.id ?? "");
    deleting = null;
  };
</script>

<CompactDialog title={t("ENVIRONMENTS")} {onDismiss} padded={false}>
  {#snippet titleTrailing()}
    {#if qrAvailable}
      <TooltipIconButton
        label={t("SCAN_QR")}
        onclick={() => void startScan()}
        class="size-9 [&_svg]:size-5"
      >
        <ScanQrCode />
      </TooltipIconButton>
    {/if}
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("BACK")}</Button>
  {/snippet}

  {#if backend.environments.length}
    {#each backend.environments as profile (profile.id)}
      <DialogSelectItem
        label={profile.name}
        subtitle={address(profile)}
        selected={profile.id === backend.active?.id}
        onclick={() => backend.select(profile.id)}
      >
        {#snippet trailing()}
          {#if profile.id === backend.active?.id}
            <TooltipIconButton
              label={settings.environmentLocked ? t("UNLOCK_SELECTION") : t("LOCK_SELECTION")}
              class="[&_svg]:size-[18px]"
              onclick={() => (settings.environmentLocked = !settings.environmentLocked)}
            >
              {#if settings.environmentLocked}
                <Lock class="text-accent" />
              {:else}
                <LockOpen />
              {/if}
            </TooltipIconButton>
          {/if}
          <TooltipIconButton
            label={t("EDIT_ENVIRONMENT")}
            class="[&_svg]:size-[18px]"
            onclick={() => {
              editing = { ...profile };
              isNew = false;
            }}
          >
            <Pencil />
          </TooltipIconButton>
          <TooltipIconButton label={t("DELETE")} class="[&_svg]:size-[18px]" onclick={() => (deleting = profile)}>
            <Trash2 />
          </TooltipIconButton>
        {/snippet}
      </DialogSelectItem>
    {/each}
  {:else}
    <EmptyState text={t("NO_ENVIRONMENTS")} />
  {/if}
  <div class="mt-2 px-5">
    <ActionButton
      text={t("ADD_ENVIRONMENT")}
      onclick={() => {
        editing = blank();
        isNew = true;
      }}
      class="w-full"
    />
  </div>
</CompactDialog>

{#if editing}
  {@const profile = editing}
  <EnvironmentDialog {profile} {isNew} onSave={save} onDismiss={() => (editing = null)} />
{/if}

{#if deleting}
  {@const profile = deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_ENVIRONMENT_CONFIRM", profile.name)}
    confirmLabel={t("DELETE")}
    onConfirm={() => remove(profile)}
    onDismiss={() => (deleting = null)}
  />
{/if}
