<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Values {
    remoteControl: boolean | null;
    coAuthored: boolean;
    sessionUpload: boolean | null;
    dataSharing: string;
    errorReports: boolean;
  }

  interface Props extends Values {
    dataSharingLevels: string[];
    dataSharingInherited: string | null;
    errorReportsInherited: boolean;
    onConfirm: (values: Values) => void;
    onDismiss: () => void;
  }

  const {
    remoteControl,
    coAuthored,
    sessionUpload,
    dataSharing,
    dataSharingLevels,
    dataSharingInherited,
    errorReports,
    errorReportsInherited,
    onConfirm,
    onDismiss,
  }: Props = $props();

  const OPTIONS = [
    { value: "", label: t("OPTION_DEFAULT") },
    { value: "on", label: t("OPTION_ON") },
    { value: "off", label: t("OPTION_OFF") },
  ];

  const SWITCH_OPTIONS = OPTIONS.slice(1);

  const LEVEL_TEXT: Record<string, { label: string; description: string }> = {
    full: { label: "DATA_SHARING_FULL", description: "DATA_SHARING_FULL_DESC" },
    no_telemetry: { label: "DATA_SHARING_NO_TELEMETRY", description: "DATA_SHARING_NO_TELEMETRY_DESC" },
    essential: { label: "DATA_SHARING_ESSENTIAL", description: "DATA_SHARING_ESSENTIAL_DESC" },
  };

  const toOption = (value: boolean | null) => (value === null ? "" : value ? "on" : "off");
  const toValue = (option: string) => (option === "" ? null : option === "on");

  let remote = $state(untrack(() => toOption(remoteControl)));
  let coAuthor = $state(untrack(() => toOption(coAuthored)));
  let upload = $state(untrack(() => toOption(sessionUpload)));
  let sharing = $state(untrack(() => dataSharing));
  let reports = $state(untrack(() => toOption(errorReports)));

  const levelOptions = $derived(
    dataSharingLevels.map((value) => ({ value, label: LEVEL_TEXT[value] ? t(LEVEL_TEXT[value].label) : value })),
  );
  const sharingShown = $derived(
    dataSharingInherited !== null &&
      dataSharingLevels.indexOf(dataSharingInherited) > dataSharingLevels.indexOf(sharing)
      ? dataSharingInherited
      : sharing,
  );
  const reportsHeld = $derived(errorReportsInherited || sharingShown === "essential");
  const reportsHint = $derived(
    errorReportsInherited
      ? "SET_BY_SERVER_ENVIRONMENT"
      : sharingShown === "essential"
        ? "ERROR_REPORTS_ESSENTIAL"
        : "ERROR_REPORTS_DESC",
  );
</script>

<CompactDialog title={t("PRIVACY")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button
      onclick={() =>
        onConfirm({
          remoteControl: toValue(remote),
          coAuthored: coAuthor === "on",
          sessionUpload: toValue(upload),
          dataSharing: sharing,
          errorReports: reports === "on",
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
      options={SWITCH_OPTIONS}
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
    <SelectField
      label={t("DATA_SHARING")}
      selected={sharingShown}
      options={levelOptions}
      enabled={dataSharingInherited === null}
      onSelect={(value) => (sharing = value)}
    />
    <p class="-mt-2.5 text-body-sm text-on-surface-variant">
      {dataSharingInherited === null
        ? t(LEVEL_TEXT[sharingShown]?.description ?? "DATA_SHARING_DESC")
        : t("SET_BY_SERVER_ENVIRONMENT")}
    </p>
    <SelectField
      label={t("ERROR_REPORTS")}
      selected={reportsHeld ? "off" : reports}
      options={SWITCH_OPTIONS}
      enabled={!reportsHeld}
      onSelect={(value) => (reports = value)}
    />
    <p class="-mt-2.5 text-body-sm text-on-surface-variant">{t(reportsHint)}</p>
  </div>
</CompactDialog>
