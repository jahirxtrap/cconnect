<script lang="ts">
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import { address, backend, type EnvironmentProfile } from "$lib/services/backend.svelte";
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
    <TooltipIconButton
      label={t("ADD_ENVIRONMENT")}
      class="size-8"
      onclick={() => {
        editing = blank();
        isNew = true;
      }}
    >
      <Plus size={18} />
    </TooltipIconButton>
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
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
          <span class="flex shrink-0 items-center">
            <TooltipIconButton
              label={t("EDIT_ENVIRONMENT")}
              class="size-8"
              onclick={() => {
                editing = { ...profile };
                isNew = false;
              }}
            >
              <Pencil size={15} />
            </TooltipIconButton>
            <TooltipIconButton label={t("DELETE")} class="size-8" onclick={() => (deleting = profile)}>
              <Trash2 size={15} />
            </TooltipIconButton>
          </span>
        {/snippet}
      </DialogSelectItem>
    {/each}
  {:else}
    <EmptyState text={t("NO_ENVIRONMENTS")} />
  {/if}
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
