<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Visibility {
    thinking: string;
    toolUse: string;
    fileChange: string;
    compact: string;
    working: string;
  }

  interface Props extends Visibility {
    onConfirm: (values: Visibility) => void;
    onDismiss: () => void;
  }

  const { thinking, toolUse, fileChange, compact, working, onConfirm, onDismiss }: Props = $props();

  const FULL = { value: "full", label: t("SHOW_FULL") };
  const LABEL = { value: "label", label: t("SHOW_LABEL") };
  const OFF = { value: "off", label: t("SHOW_OFF") };

  const three = [FULL, LABEL, OFF];
  const two = [FULL, LABEL];
  const labelOff = [LABEL, OFF];

  let values = $state<Visibility>(untrack(() => ({ thinking, toolUse, fileChange, compact, working })));
</script>

<CompactDialog title={t("VISIBILITY")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(values)}>{t("SAVE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <SelectField
      label={t("THINKING")}
      selected={values.thinking}
      options={three}
      onSelect={(value) => (values = { ...values, thinking: value })}
    />
    <SelectField
      label={t("TOOLS")}
      selected={values.toolUse}
      options={three}
      onSelect={(value) => (values = { ...values, toolUse: value })}
    />
    <SelectField
      label={t("FILE_CHANGES")}
      selected={values.fileChange}
      options={three}
      onSelect={(value) => (values = { ...values, fileChange: value })}
    />
    <SelectField
      label={t("COMPACTED")}
      selected={values.compact}
      options={two}
      onSelect={(value) => (values = { ...values, compact: value })}
    />
    <SelectField
      label={t("WORKING")}
      selected={values.working}
      options={labelOff}
      onSelect={(value) => (values = { ...values, working: value })}
    />
  </div>
</CompactDialog>
