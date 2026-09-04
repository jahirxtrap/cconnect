<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Values {
    remoteControl: boolean | null;
    coAuthored: boolean | null;
    sessionUpload: boolean | null;
  }

  interface Props extends Values {
    onConfirm: (values: Values) => void;
    onDismiss: () => void;
  }

  const { remoteControl, coAuthored, sessionUpload, onConfirm, onDismiss }: Props = $props();

  const OPTIONS = [
    { value: "", label: t("OPTION_DEFAULT") },
    { value: "on", label: t("OPTION_ON") },
    { value: "off", label: t("OPTION_OFF") },
  ];

  const toOption = (value: boolean | null) => (value === null ? "" : value ? "on" : "off");
  const toValue = (option: string) => (option === "" ? null : option === "on");

  let remote = $state(untrack(() => toOption(remoteControl)));
  let coAuthor = $state(untrack(() => toOption(coAuthored)));
  let upload = $state(untrack(() => toOption(sessionUpload)));
</script>

<CompactDialog title={t("PRIVACY")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button
      onclick={() =>
        onConfirm({
          remoteControl: toValue(remote),
          coAuthored: toValue(coAuthor),
          sessionUpload: toValue(upload),
        })}
    >
      {t("SAVE")}
    </Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <SelectField
      label={t("REMOTE_CONTROL")}
      selected={remote}
      options={OPTIONS}
      onSelect={(value) => (remote = value)}
    />
    <p class="-mt-2.5 text-body-sm text-on-surface-variant">{t("REMOTE_CONTROL_DESC")}</p>
    <SelectField
      label={t("CO_AUTHORED")}
      selected={coAuthor}
      options={OPTIONS}
      onSelect={(value) => (coAuthor = value)}
    />
    <p class="-mt-2.5 text-body-sm text-on-surface-variant">{t("CO_AUTHORED_DESC")}</p>
    <SelectField
      label={t("SESSION_UPLOAD")}
      selected={upload}
      options={OPTIONS}
      onSelect={(value) => (upload = value)}
    />
    <p class="-mt-2.5 text-body-sm text-on-surface-variant">{t("SESSION_UPLOAD_DESC")}</p>
  </div>
</CompactDialog>
