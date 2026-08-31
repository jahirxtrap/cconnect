<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Visibility {
    simple: string;
    thinking: string;
    toolUse: string;
    fileChange: string;
    compact: string;
    working: string;
    tokens: string;
  }

  interface Props extends Visibility {
    server?: Visibility | null;
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
    tokens,
    server = null,
    title = t("VISIBILITY"),
    quickChat = true,
    onConfirm,
    onDismiss,
  }: Props = $props();

  const FULL = { value: "full", label: t("SHOW_FULL") };
  const LABEL = { value: "label", label: t("SHOW_LABEL") };
  const OFF = { value: "off", label: t("SHOW_OFF") };
  const ON = { value: "on", label: t("OPTION_ON") };
  const NO = { value: "off", label: t("OPTION_OFF") };
  const SERVER = { value: "", label: t("SERVER_DEFAULT") };

  const withServer = (base: { value: string; label: string }[]) =>
    server ? [SERVER, ...base] : base;

  const three = withServer([FULL, LABEL, OFF]);
  const two = withServer([FULL, LABEL]);
  const labelOff = withServer([LABEL, OFF]);
  const onOff = withServer([ON, NO]);

  let values = $state<Visibility>(
    untrack(() => ({ simple, thinking, toolUse, fileChange, compact, working, tokens })),
  );

  const isSimple = $derived((values.simple || server?.simple) === "on");

  const named = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  const inherited = (options: { value: string; label: string }[], value: string, fallback: string) =>
    value === "" && server ? named(options, fallback) : null;
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(values)}>{t("SAVE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    {#if server}
      <SelectField
        label={t("SIMPLE_MODE")}
        selected={values.simple}
        shown={inherited(onOff, values.simple, server.simple)}
        options={onOff}
        onSelect={(value) => (values = { ...values, simple: value })}
      />
    {:else}
      <SwitchRow
        title={t("SIMPLE_MODE")}
        summary={t("SIMPLE_MODE_SUMMARY")}
        checked={isSimple}
        onChange={(checked) => (values = { ...values, simple: checked ? "on" : "off" })}
      />
    {/if}
    <SelectField
      label={t("THINKING")}
      selected={isSimple ? "off" : values.thinking}
      shown={isSimple ? null : inherited(three, values.thinking, server?.thinking ?? "")}
      options={three}
      enabled={!isSimple}
      onSelect={(value) => (values = { ...values, thinking: value })}
    />
    <SelectField
      label={t("TOOLS")}
      selected={isSimple ? "off" : values.toolUse}
      shown={isSimple ? null : inherited(three, values.toolUse, server?.toolUse ?? "")}
      options={three}
      enabled={!isSimple}
      onSelect={(value) => (values = { ...values, toolUse: value })}
    />
    <SelectField
      label={t("FILE_CHANGES")}
      selected={values.fileChange}
      shown={inherited(three, values.fileChange, server?.fileChange ?? "")}
      options={three}
      onSelect={(value) => (values = { ...values, fileChange: value })}
    />
    <SelectField
      label={t("COMPACTED")}
      selected={isSimple ? "label" : values.compact}
      shown={isSimple ? null : inherited(two, values.compact, server?.compact ?? "")}
      options={two}
      enabled={!isSimple}
      onSelect={(value) => (values = { ...values, compact: value })}
    />
    {#if quickChat}
      <SelectField
        label={t("QUICK_CHAT_WORKING")}
        selected={values.working}
        shown={inherited(labelOff, values.working, server?.working ?? "")}
        options={labelOff}
        onSelect={(value) => (values = { ...values, working: value })}
      />
    {/if}
    {#if server}
      <SelectField
        label={t("SHOW_TOKENS")}
        selected={values.tokens}
        shown={inherited(onOff, values.tokens, server.tokens)}
        options={onOff}
        onSelect={(value) => (values = { ...values, tokens: value })}
      />
    {:else}
      <SwitchRow
        title={t("SHOW_TOKENS")}
        summary={t("SHOW_TOKENS_SUMMARY")}
        checked={values.tokens === "on"}
        onChange={(checked) => (values = { ...values, tokens: checked ? "on" : "off" })}
      />
    {/if}
  </div>
</CompactDialog>
