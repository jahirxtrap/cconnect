<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import NotepadText from "@lucide/svelte/icons/notepad-text";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import Palette from "@lucide/svelte/icons/palette";
  import X from "@lucide/svelte/icons/x";
  import {
    componentBlocked,
    componentHidden,
    componentInvalid,
    VALUE_SEPARATOR,
    type ComponentElement,
    type InteractionData,
  } from "$lib/data/chatModels";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import { parseCconnectBlock } from "$lib/markdown/cconnectBlock";
  import CconnectBlockView from "$lib/ui/CconnectBlockView.svelte";
  import CollapsibleSection from "$lib/ui/CollapsibleSection.svelte";
  import ColorDialog from "$lib/ui/ColorDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";
  import OptionRow from "$lib/ui/OptionRow.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import Slider from "$lib/ui/Slider.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ComponentElements from "./ComponentElements.svelte";
  import { keyed } from "./componentKeys";

  interface Props {
    list: ComponentElement[];
    data: InteractionData;
    colors: string[];
    onGrow: (grow: () => void, anchor: HTMLElement | null) => void;
    onValue: (id: string, value: string) => void;
    onPick: (id: string, value: string, multiple: boolean) => void;
    onPreviewOpen: (url: string, filename: string) => void;
    onUpload: (file: File, onProgress: (value: number) => void) => Promise<string | null>;
  }

  const { list, data, colors, onGrow, onValue, onPick, onPreviewOpen, onUpload }: Props = $props();

  const valueOf = (element: ComponentElement) => data.values[element.id ?? ""] ?? "";

  const visible = $derived(
    list.filter((element) => {
      if (componentHidden(element, data.values)) return false;
      if (element.type === "text") return !!element.text?.trim();
      if (element.type === "preview") return !!element.block && !!parseCconnectBlock(element.block);
      return true;
    }),
  );

  const picked = (id: string | null) => (data.values[id ?? ""] ?? "").split(VALUE_SEPARATOR).filter(Boolean);

  const errorOf = (element: ComponentElement) =>
    valueOf(element) && componentInvalid(element, data.values) ? (element.error ?? t("INVALID_VALUE")) : null;

  const openNotes = $state<Record<string, boolean>>({});
  const notesShown = (element: ComponentElement) => openNotes[element.id ?? ""] ?? valueOf(element) !== "";

  const openGroups = $state<Record<string, boolean>>({});
  const groupKey = (element: ComponentElement, index: number) => element.id ?? element.label ?? String(index);

  let browsing = $state<ComponentElement | null>(null);
  let colouring = $state<ComponentElement | null>(null);
  let uploading = $state<string | null>(null);

  const colorOptions = $derived(
    colors
      .map((name) => ({ value: name, color: sessionColorOf(name) ?? "", label: name }))
      .filter((option) => option.color !== ""),
  );

  const fileNames = (element: ComponentElement) =>
    picked(element.id)
      .map((path) => path.split("/").pop() ?? path)
      .join(", ");

  const PICKER_ROW =
    "flex w-full items-center gap-2 rounded-item py-1.5 pr-1 pl-2 transition-colors hover:bg-on-surface/8";
  const PICKER_MAIN =
    "flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-on-surface disabled:cursor-default";

  const attach = async (element: ComponentElement, files: FileList | null) => {
    const id = element.id ?? "";
    if (!files?.length || uploading) return;
    uploading = id;
    const saved: string[] = [];
    for (const file of Array.from(files)) {
      const path = await onUpload(file, () => {});
      if (path) saved.push(path);
    }
    uploading = null;
    if (saved.length) onValue(id, saved.join(VALUE_SEPARATOR));
  };
</script>

{#if browsing}
  {@const element = browsing}
  <PathPickerDialog
    mode={element.pick === "file" ? "file" : "dir"}
    start={element.start ?? ""}
    onConfirm={(path) => {
      onValue(element.id ?? "", path);
      browsing = null;
    }}
    onDismiss={() => (browsing = null)}
  />
{/if}

{#if colouring}
  {@const element = colouring}
  <ColorDialog
    title={element.label ?? t("COLOR")}
    options={colorOptions}
    selected={valueOf(element) || null}
    onSelect={(name) => onValue(element.id ?? "", name ?? "")}
    onDismiss={() => (colouring = null)}
  />
{/if}

{#snippet clearButton(element: ComponentElement, filled: boolean)}
  <TooltipIconButton
    label={t("CLEAR")}
    tooltip={false}
    enabled={!data.submitted && filled}
    onclick={() => onValue(element.id ?? "", "")}
    class="size-6 [&_svg]:size-4"
  >
    <X size={16} class="text-on-surface" />
  </TooltipIconButton>
{/snippet}

{#each visible as element, index (index)}
  <div class="flex flex-col gap-1">
    {#if element.type === "text"}
      <MarkdownText text={element.text ?? ""} />
    {:else if element.type === "preview" && element.block}
      {@const parsed = parseCconnectBlock(element.block)}
      {#if parsed}
        <div class="w-full">
          <CconnectBlockView data={parsed} onOpen={onPreviewOpen} compact />
        </div>
      {/if}
    {:else if element.type === "group"}
      {@const key = groupKey(element, index)}
      {@const blocked = componentBlocked(element.blocks, data.values)}
      <CollapsibleSection
        label={element.label ?? ""}
        open={openGroups[key] ?? element.open}
        marked={blocked}
        onToggle={(header) => onGrow(() => (openGroups[key] = !(openGroups[key] ?? element.open)), header)}
      >
        <ComponentElements
          list={element.blocks}
          {data}
          {colors}
          {onGrow}
          {onValue}
          {onPick}
          {onPreviewOpen}
          {onUpload}
        />
      </CollapsibleSection>
    {:else if element.type === "select"}
      {@const dropdown = element.display === "dropdown" && !element.multiple}
      {#if element.label?.trim() && !dropdown}
        <p class="text-body-md">
          {element.label}{#if element.required}<span class="text-error">&nbsp;*</span>{/if}
        </p>
      {/if}
      {#if dropdown}
        {@const chosen = valueOf(element)}
        <SelectField
          label={element.label ?? ""}
          selected={chosen}
          options={element.options.map((option) => ({ value: option.value, label: option.label }))}
          shown={element.options.find((option) => option.value === chosen)?.label ?? t("SELECT_OPTION")}
          enabled={!data.submitted}
          onSelect={(value) => !data.submitted && onPick(element.id ?? "", value, false)}
        />
      {:else}
        {#each element.options as option (option.value)}
          {@const selected = picked(element.id).includes(option.value)}
          <OptionRow
            label={option.label}
            onclick={() => !data.submitted && onPick(element.id ?? "", option.value, element.multiple)}
            description={option.description}
            {selected}
            multi={element.multiple}
          />
          {#if selected && option.preview?.trim()}
            <OutlinedPanel class="w-full">
              <MarkdownText text={option.preview.replace(/\n+$/, "")} dense />
            </OutlinedPanel>
          {/if}
        {/each}
      {/if}
    {:else if element.type === "input"}
      <InputField
        label={element.label ?? undefined}
        required={element.required}
        value={valueOf(element)}
        oninput={(value) => !data.submitted && onValue(element.id ?? "", value)}
        placeholder={element.placeholder ?? keyed(element.placeholderKey) ?? undefined}
        singleLine={element.lines === null && !element.multiline}
        minLines={element.lines ?? 1}
        maxLines={element.lines ?? (element.multiline ? 6 : 1)}
        secret={element.secret}
        numeric={element.format === "number"}
        error={errorOf(element)}
      />
    {:else if element.type === "toggle"}
      <SwitchRow
        title={element.label ?? ""}
        required={element.required}
        checked={valueOf(element) === "true"}
        enabled={!data.submitted}
        onChange={(next) => onValue(element.id ?? "", String(next))}
      />
    {:else if element.type === "slider"}
      {#if element.label?.trim()}
        <p class="text-body-md">
          {element.label}{#if element.required}<span class="text-error">&nbsp;*</span>{/if}
        </p>
      {/if}
      <Slider
        value={Number(valueOf(element) || element.value || element.min || 0)}
        min={element.min ?? 0}
        max={element.max ?? 100}
        step={element.step ?? 1}
        enabled={!data.submitted}
        showValue={element.display !== "bare"}
        onChange={(next) => onValue(element.id ?? "", String(next))}
      />
    {:else if element.type === "color"}
      {@const name = valueOf(element)}
      <div class={PICKER_ROW}>
        <button
          type="button"
          disabled={data.submitted}
          onclick={() => (colouring = element)}
          class={PICKER_MAIN}
        >
          {#if name && sessionColorOf(name)}
            <span class="size-4 shrink-0 rounded-full" style="background: {sessionColorOf(name)}"></span>
          {:else}
            <Palette size={16} class="shrink-0 text-on-surface-variant" />
          {/if}
          <span class="min-w-0 flex-1 truncate text-body-md">
            {element.label ?? t("COLOR")}{#if element.required}<span class="text-error">&nbsp;*</span>{/if}
          </span>
          <span class="shrink-0 truncate text-body-sm text-on-surface-variant">{name || t("CHOOSE")}</span>
        </button>
        {@render clearButton(element, name !== "")}
      </div>
    {:else if element.type === "path"}
      {@const path = valueOf(element)}
      <div class={PICKER_ROW}>
        <button type="button" disabled={data.submitted} onclick={() => (browsing = element)} class={PICKER_MAIN}>
          <Folder size={16} class="shrink-0 text-accent" />
          <span class="min-w-0 flex-1 truncate text-body-md">
            {element.label ?? ""}{#if element.required}<span class="text-error">&nbsp;*</span>{/if}
          </span>
          <span class="min-w-0 max-w-[55%] shrink-0 truncate text-body-sm text-on-surface-variant">
            {path || t("CHOOSE")}
          </span>
        </button>
        {@render clearButton(element, path !== "")}
      </div>
    {:else if element.type === "file"}
      {@const names = fileNames(element)}
      <div class={PICKER_ROW}>
        <label class={PICKER_MAIN}>
          <Paperclip size={16} class="shrink-0 text-accent" />
          <span class="min-w-0 flex-1 truncate text-body-md">
            {element.label ?? ""}{#if element.required}<span class="text-error">&nbsp;*</span>{/if}
          </span>
          <span class="min-w-0 max-w-[55%] shrink-0 truncate text-body-sm text-on-surface-variant">
            {uploading === element.id ? t("UPLOADING") : names || t("CHOOSE")}
          </span>
          <input
            type="file"
            class="hidden"
            multiple={element.multiple}
            accept={element.accept ?? undefined}
            disabled={data.submitted || uploading !== null}
            onchange={(event) => void attach(element, event.currentTarget.files)}
          />
        </label>
        {@render clearButton(element, names !== "")}
      </div>
    {:else if element.type === "bar"}
      {@const percent = Number(element.value ?? 0)}
      <MetricBar
        title={element.label ?? ""}
        subtitle={element.text || (keyed(element.textKey) ?? "")}
        showValue={element.display !== "bare"}
        {percent}
        alert={(element.alertAbove !== null && percent >= element.alertAbove) ||
          (element.alertBelow !== null && percent <= element.alertBelow)}
        color={sessionColorOf(element.color)}
      />
    {:else if element.type === "notes"}
      {#if notesShown(element)}
        <InputField
          value={valueOf(element)}
          oninput={(value) => !data.submitted && onValue(element.id ?? "", value)}
          placeholder={element.placeholder ?? keyed(element.placeholderKey) ?? undefined}
          maxLines={3}
          clearAlways
          onClear={() =>
            valueOf(element).trim() ? onValue(element.id ?? "", "") : (openNotes[element.id ?? ""] = false)}
        />
      {:else}
        <button
          type="button"
          onclick={() => (openNotes[element.id ?? ""] = true)}
          class="flex w-full cursor-pointer items-center gap-2 rounded-item px-2 py-1.5 text-left text-label-lg text-accent transition-colors select-none hover:bg-on-surface/8"
        >
          <NotepadText size={18} class="shrink-0" />
          <span class="truncate">{element.label?.trim() || t("ADD_NOTES")}</span>
        </button>
      {/if}
    {/if}
  </div>
{/each}
