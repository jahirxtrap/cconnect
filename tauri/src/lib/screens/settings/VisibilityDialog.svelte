<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import CompactSwitch from "$lib/ui/CompactSwitch.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Visibility {
    simple: boolean;
    thinking: string;
    toolUse: string;
    fileChange: string;
    compact: string;
    working: string;
  }

  interface Props extends Visibility {
    title?: string;
    quickChat?: boolean;
    onConfirm: (values: Visibility) => void;
    onDismiss: () => void;
  }

  const {
    simple,
    thinking,
    toolUse,
    fileChange,
    compact,
    working,
    title = t("VISIBILITY"),
    quickChat = true,
    onConfirm,
    onDismiss,
  }: Props = $props();

  const FULL = { value: "full", label: t("SHOW_FULL") };
  const LABEL = { value: "label", label: t("SHOW_LABEL") };
  const OFF = { value: "off", label: t("SHOW_OFF") };

  const three = [FULL, LABEL, OFF];
  const two = [FULL, LABEL];
  const labelOff = [LABEL, OFF];

  let values = $state<Visibility>(
    untrack(() => ({ simple, thinking, toolUse, fileChange, compact, working })),
  );
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(values)}>{t("SAVE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <div class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-body-md">{t("SIMPLE_MODE")}</p>
        <p class="text-body-sm text-on-surface-variant">{t("SIMPLE_MODE_SUMMARY")}</p>
      </div>
      <CompactSwitch
        checked={values.simple}
        onCheckedChange={(checked) => (values = { ...values, simple: checked })}
      />
    </div>
    <SelectField
      label={t("THINKING")}
      selected={values.simple ? "off" : values.thinking}
      options={three}
      enabled={!values.simple}
      onSelect={(value) => (values = { ...values, thinking: value })}
    />
    <SelectField
      label={t("TOOLS")}
      selected={values.simple ? "off" : values.toolUse}
      options={three}
      enabled={!values.simple}
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
    {#if quickChat}
      <SelectField
        label={t("QUICK_CHAT_WORKING")}
        selected={values.working}
        options={labelOff}
        onSelect={(value) => (values = { ...values, working: value })}
      />
    {/if}
  </div>
</CompactDialog>
