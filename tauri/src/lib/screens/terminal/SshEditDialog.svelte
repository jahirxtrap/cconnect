<script lang="ts">
  import { untrack } from "svelte";
  import type { SshProfile } from "$lib/data/sshStore.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";

  interface Props {
    initial: SshProfile | null;
    onConfirm: (profile: SshProfile) => void;
    onDismiss: () => void;
  }

  const { initial, onConfirm, onDismiss }: Props = $props();

  const DEFAULT_PORT = 22;

  const start = untrack(() => initial);

  let name = $state(start?.name ?? "");
  let host = $state(start?.host ?? "");
  let port = $state(String(start?.port ?? DEFAULT_PORT));
  let user = $state(start?.user ?? "");
  let password = $state(start?.password ?? "");

  const save = () => {
    onConfirm({
      id: start?.id ?? crypto.randomUUID(),
      name: name.trim() || host.trim(),
      host: host.trim(),
      port: Number.parseInt(port.trim(), 10) || DEFAULT_PORT,
      user: user.trim(),
      password,
      os: start?.os ?? null,
    });
  };
</script>

<CompactDialog title={t(start ? "EDIT_SSH_HOST" : "ADD_SSH_HOST")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save} variant="filled" enabled={!!host.trim() && !!user.trim()}>{t("SAVE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-2">
    <InputField value={name} oninput={(value) => (name = value)} label={t("SSH_NAME")} singleLine />
    <InputField value={host} oninput={(value) => (host = value)} label={t("HOST")} singleLine />
    <InputField
      value={port}
      oninput={(value) => (port = value.replace(/\D/g, ""))}
      label={t("PORT")}
      singleLine
    />
    <InputField value={user} oninput={(value) => (user = value)} label={t("SSH_USER")} singleLine />
    <InputField
      value={password}
      oninput={(value) => (password = value)}
      label={t("SSH_PASSWORD")}
      singleLine
      secret
    />
  </div>
</CompactDialog>
