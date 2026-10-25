<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import type { AccountOption } from "$lib/services/capabilitiesApi";
  import {
    DELEGATE_KINDS,
    TASK_TOKEN,
    type Delegate,
    type DelegateArgs,
    type DelegateKind,
    type DelegatePreset,
  } from "$lib/services/delegatesApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import { DELEGATE_KIND_LABELS } from "./settingsValues";

  interface Props {
    delegate: Delegate;
    isNew: boolean;
    presets: DelegatePreset[];
    accounts: AccountOption[];
    onSave: (delegate: Delegate) => void;
    onDismiss: () => void;
  }

  const { delegate, isNew, presets, accounts, onSave, onDismiss }: Props = $props();

  const ACCOUNT_KINDS: DelegateKind[] = ["model", "claude"];
  const COMMAND_KINDS: DelegateKind[] = ["command", "acp"];
  const textOf = (source: DelegateArgs): Record<keyof DelegateArgs, string> => ({
    args: source.args.join("\n"),
    editArgs: source.editArgs.join("\n"),
    bypassArgs: source.bypassArgs.join("\n"),
  });

  const linesOf = (text: string): string[] => text.split("\n").map((arg) => arg.trim()).filter(Boolean);

  let draft = $state<Delegate>({ ...untrack(() => delegate) });
  let argTexts = $state(untrack(() => textOf(delegate)));

  const kindOptions = DELEGATE_KINDS.map((kind) => ({ value: kind, label: t(DELEGATE_KIND_LABELS[kind]) }));
  const accountOptions = $derived([
    { value: "", label: t("DELEGATE_ACCOUNT_DEFAULT") },
    ...accounts.map((account) => ({ value: account.id, label: account.label })),
  ]);
  const presetOptions = $derived(presets.map((preset, index) => ({ value: String(index), label: preset.name })));

  const usesAccount = $derived(ACCOUNT_KINDS.includes(draft.kind));
  const usesCommand = $derived(COMMAND_KINDS.includes(draft.kind));
  const valid = $derived(!!draft.name.trim() && (!usesCommand || !!draft.command?.trim()));

  const applyPreset = (value: string) => {
    const preset = presets[Number(value)];
    if (!preset) return;
    draft = { ...draft, kind: preset.kind, name: draft.name || preset.name, command: preset.command };
    argTexts = textOf(preset);
  };

  const save = () =>
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      account: usesAccount ? draft.account || null : null,
      command: usesCommand ? draft.command?.trim() || null : null,
      args: usesCommand ? linesOf(argTexts.args) : [],
      editArgs: draft.kind === "command" ? linesOf(argTexts.editArgs) : [],
      bypassArgs: draft.kind === "command" ? linesOf(argTexts.bypassArgs) : [],
    });
</script>

<CompactDialog title={isNew ? t("ADD_DELEGATE") : t("EDIT_DELEGATE")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save} enabled={valid}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex w-full flex-col gap-2">
    {#if isNew && presets.length}
      <SelectField label={t("DELEGATE_TEMPLATE")} selected="" shown={t("DELEGATE_TEMPLATE_NONE")} options={presetOptions} onSelect={applyPreset} />
    {/if}
    <SelectField
      label={t("DELEGATE_KIND")}
      selected={draft.kind}
      options={kindOptions}
      onSelect={(value) => (draft = { ...draft, kind: value as DelegateKind })}
    />
    <InputField value={draft.name} oninput={(value) => (draft = { ...draft, name: value })} label={t("NAME")} singleLine autofocus />
    <InputField
      value={draft.description}
      oninput={(value) => (draft = { ...draft, description: value })}
      label={t("DELEGATE_DESCRIPTION")}
      optional
      minLines={2}
    />
    {#if usesAccount}
      <SelectField
        label={t("ACCOUNT")}
        selected={draft.account ?? ""}
        options={accountOptions}
        onSelect={(value) => (draft = { ...draft, account: value || null })}
      />
    {/if}
    {#if usesCommand}
      <InputField value={draft.command ?? ""} oninput={(value) => (draft = { ...draft, command: value })} label={t("DELEGATE_COMMAND")} singleLine />
      <div class="flex flex-col gap-1.5">
        <InputField
          value={argTexts.args}
          oninput={(value) => (argTexts = { ...argTexts, args: value })}
          label={t("DELEGATE_ARGS")}
          optional
          minLines={2}
        />
        {#if draft.kind === "command"}
          <p class="text-body-sm text-on-surface-variant">{t("DELEGATE_ARGS_HINT", TASK_TOKEN)}</p>
        {/if}
      </div>
      {#if draft.kind === "command"}
        <InputField
          value={argTexts.editArgs}
          oninput={(value) => (argTexts = { ...argTexts, editArgs: value })}
          label={t("DELEGATE_EDIT_ARGS")}
          optional
          minLines={2}
        />
        <div class="flex flex-col gap-1.5">
          <InputField
            value={argTexts.bypassArgs}
            oninput={(value) => (argTexts = { ...argTexts, bypassArgs: value })}
            label={t("DELEGATE_BYPASS_ARGS")}
            optional
            minLines={2}
          />
          <p class="text-body-sm text-on-surface-variant">{t("DELEGATE_MODE_ARGS_HINT")}</p>
        </div>
      {/if}
    {/if}
    <SwitchRow title={t("DELEGATE_ENABLED")} checked={draft.enabled} onChange={(enabled) => (draft = { ...draft, enabled })} />
  </div>
</CompactDialog>
