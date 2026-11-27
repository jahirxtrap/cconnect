<script lang="ts" module>
  import type { CustomKind } from "$lib/services/claudeApi";

  export const CUSTOM_TEXTS: Record<CustomKind, { create: string; edit: string; summary: string }> = {
    styles: { create: "STYLE_NEW", edit: "STYLE_EDIT", summary: "STYLE_EDITOR_SUMMARY" },
    commands: { create: "COMMAND_NEW", edit: "COMMAND_EDIT", summary: "COMMAND_EDITOR_SUMMARY" },
    agents: { create: "CLAUDE_AGENT_NEW", edit: "CLAUDE_AGENT_EDIT", summary: "CLAUDE_AGENT_EDITOR_SUMMARY" },
  };
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { slugOf } from "$lib/design/packs/reader";
  import { t } from "$lib/i18n/index.svelte";
  import {
    CUSTOM_SCOPES,
    type Customization,
    type CustomizationDraft,
    type CustomScope,
  } from "$lib/services/claudeApi";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import { FIELD_LABEL_CLASS } from "$lib/ui/field";
  import InputField from "$lib/ui/InputField.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    kind: CustomKind;
    item: Customization | null;
    folders: Record<CustomScope, string | null>;
    scopeLabels: Record<CustomScope, string>;
    busy: boolean;
    error: string | null;
    onSave: (draft: CustomizationDraft) => void;
    onDismiss: () => void;
  }

  const { kind, item, folders, scopeLabels, busy, error, onSave, onDismiss }: Props = $props();

  const MIN_LINES = 6;
  const SUFFIX = ".md";

  const initial = untrack(() => item);

  let name = $state(initial?.name ?? "");
  let description = $state(initial?.description ?? "");
  let body = $state(initial?.body ?? "");
  let keepCoding = $state(initial?.keepCodingInstructions ?? true);
  let scope = $state<CustomScope>((initial?.source as CustomScope | undefined) ?? CUSTOM_SCOPES[0]);

  const texts = $derived(CUSTOM_TEXTS[kind]);
  const scopes = $derived(CUSTOM_SCOPES.filter((option) => folders[option] !== null));
  const stem = $derived(slugOf(name));
  const directory = $derived(initial?.file?.includes("/") ? initial.file.slice(0, initial.file.lastIndexOf("/") + 1) : "");

  const path = $derived.by(() => {
    const folder = folders[scope] ?? "";
    const separator = folder.includes("\\") ? "\\" : "/";
    return stem ? [folder, `${directory}${stem}${SUFFIX}`.replaceAll("/", separator)].join(separator) : folder;
  });

  const ready = $derived(!!stem && (kind !== "agents" || !!description.trim()) && !busy);

  const save = () =>
    onSave({ scope, file: initial?.file ?? null, name, description, keepCodingInstructions: keepCoding, body });
</script>

<CompactDialog title={t(initial ? texts.edit : texts.create)} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save} enabled={ready}>{t(initial ? "SAVE" : "CREATE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-3.5">
    <p class="text-body-sm text-on-surface-variant">{t(texts.summary)}</p>
    <InputField value={name} oninput={(value) => (name = value)} label={t("NAME")} {error} singleLine autofocus={!initial} />
    <InputField value={description} oninput={(value) => (description = value)} label={t("DESCRIPTION")} singleLine />
    <div>
      <p class={FIELD_LABEL_CLASS}>{t("CUSTOM_SAVED_IN")}</p>
      <div class="flex min-w-0 items-center gap-3">
        {#if !initial && scopes.length > 1}
          <SegmentedButtons
            options={scopes.map((option) => scopeLabels[option])}
            selected={scopes.indexOf(scope)}
            onSelect={(index) => (scope = scopes[index])}
            shortcuts={false}
            class="shrink-0"
          />
        {/if}
        <p class="min-w-0 truncate text-body-sm text-on-surface-variant">{path}</p>
      </div>
    </div>
    {#if kind === "styles"}
      <SwitchRow
        title={t("KEEP_CODING_INSTRUCTIONS")}
        summary={t("KEEP_CODING_INSTRUCTIONS_SUMMARY")}
        checked={keepCoding}
        onChange={(checked) => (keepCoding = checked)}
      />
    {/if}
    <InputField value={body} oninput={(value) => (body = value)} label={t("CUSTOM_INSTRUCTIONS")} minLines={MIN_LINES} />
    {#if busy}
      <LinearProgress />
    {/if}
  </div>
</CompactDialog>
