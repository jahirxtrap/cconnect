<script lang="ts">
  import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
  import Play from "@lucide/svelte/icons/play";
  import X from "@lucide/svelte/icons/x";
  import { VALUE_SEPARATOR, type ComponentElement, type InteractionData } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import { parseCconnectBlock } from "$lib/markdown/cconnectBlock";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CconnectBlockView from "$lib/ui/CconnectBlockView.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import OptionRow from "$lib/ui/OptionRow.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";

  interface Props {
    data: InteractionData;
    onValue: (id: string, value: string) => void;
    onPick: (id: string, value: string, multiple: boolean) => void;
    onSubmit: (action: string | null) => void;
    onDismiss: () => void;
    onPreviewOpen: (url: string, filename: string) => void;
  }

  const { data, onValue, onPick, onSubmit, onDismiss, onPreviewOpen }: Props = $props();

  const labelOf = (element: ComponentElement) => (element.label ?? "") + (element.required ? " *" : "");
  const ready = $derived(
    !data.blocks.some(
      (element) => element.required && element.type !== "buttons" && !data.values[element.id ?? ""],
    ),
  );

  const actions = $derived(data.blocks.find((element) => element.type === "buttons"));
  const picked = (id: string | null) =>
    (data.values[id ?? ""] ?? "").split(VALUE_SEPARATOR).filter(Boolean);

  const dirty = $derived(Object.values(data.values).some((value) => value !== ""));
  let confirmingDismiss = $state(false);

  const summary = $derived(
    data.blocks.flatMap((element) => {
      const raw = data.values[element.id ?? ""] ?? "";
      if (!element.id || !raw) return [];
      let value: string;
      if (element.type === "select" || element.type === "buttons") {
        value = raw
          .split(VALUE_SEPARATOR)
          .filter(Boolean)
          .map((item) => element.options.find((option) => option.value === item)?.label ?? item)
          .join(", ");
      } else if (element.type === "toggle") {
        value = raw === "true" ? t("YES") : t("NO");
      } else {
        value = raw;
      }
      return value ? [{ label: element.label ?? "", value }] : [];
    }),
  );
</script>

{#if confirmingDismiss}
  <ConfirmDialog
    title={t("CANCEL")}
    text={t("COMPONENT_DISCARD_CONFIRM")}
    confirmLabel={t("DISCARD")}
    onConfirm={() => {
      confirmingDismiss = false;
      onDismiss();
    }}
    onDismiss={() => (confirmingDismiss = false)}
  />
{/if}

<div class="w-full px-4">
  <OutlinedPanel>
    <div class="flex items-center gap-1.5">
      <CircleQuestionMark size={16} class="shrink-0 text-accent" />
      <span class="min-w-0 flex-1 truncate text-label-lg text-accent select-none">{data.title ?? ""}</span>
      {#if !data.submitted}
        <button
          type="button"
          onclick={() => (dirty ? (confirmingDismiss = true) : onDismiss())}
          aria-label={t("CANCEL")}
          class="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
        >
          <X size={16} />
        </button>
      {/if}
    </div>
    <div class="h-1"></div>

    {#if data.declined}
      <div class="flex items-center gap-1.5">
        <X size={10} class="shrink-0 text-on-surface-variant" />
        <span class="text-body-sm text-on-surface-variant">{t("CANCEL")}</span>
      </div>
    {:else if data.submitted}
      {#each summary as row, index (index)}
        <div class="mt-0.5">
          {#if row.label}
            <p class="text-body-md">{row.label}</p>
          {/if}
          <div class="flex items-center gap-1.5">
            <Play size={10} class="shrink-0 fill-current text-on-surface-variant" />
            <span class="text-body-sm text-on-surface-variant">{row.value}</span>
          </div>
        </div>
      {/each}
    {:else}
      {#each data.blocks as element, index (index)}
        {#if element.type === "text"}
          <MarkdownText text={element.text ?? ""} />
        {:else if element.type === "preview" && element.block}
          {@const parsed = parseCconnectBlock(element.block)}
          {#if parsed}
            <div class="mt-1 w-full">
              <CconnectBlockView data={parsed} onOpen={onPreviewOpen} compact />
            </div>
          {/if}
        {:else if element.type === "select"}
          {#if element.label?.trim()}
            <p class="text-body-md">{labelOf(element)}</p>
          {/if}
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
              <OutlinedPanel class="my-1 w-full">
                <pre
                  class="overflow-x-auto font-mono text-body-sm leading-snug whitespace-pre">{option.preview.replace(
                    /\n+$/,
                    "",
                  )}</pre>
              </OutlinedPanel>
            {/if}
          {/each}
        {:else if element.type === "input"}
          <InputField
            class="mt-1"
            label={element.label ? labelOf(element) : undefined}
            value={data.values[element.id ?? ""] ?? ""}
            oninput={(value) => !data.submitted && onValue(element.id ?? "", value)}
            placeholder={element.placeholder ?? undefined}
            singleLine={!element.multiline}
            maxLines={element.multiline ? 6 : 1}
          />
        {:else if element.type === "toggle"}
          <SwitchRow
            title={labelOf(element)}
            checked={data.values[element.id ?? ""] === "true"}
            enabled={!data.submitted}
            onChange={(next) => onValue(element.id ?? "", String(next))}
          />
        {/if}
      {/each}
    {/if}

    {#if !data.submitted && !data.declined}
      <div class="h-2"></div>
      {#if actions}
        <div class="flex flex-wrap gap-x-2 gap-y-1">
          {#each actions.options as option (option.value)}
            <Button
              variant={option.style === "primary" ? "filled" : "outlined"}
              class="h-8 text-body-md"
              enabled={ready}
              onclick={() => onSubmit(option.value)}
            >
              {option.label}
            </Button>
          {/each}
        </div>
      {:else}
        <ActionButton
          class="w-full"
          text={data.submitLabel?.trim() ? data.submitLabel : t("SEND")}
          enabled={ready}
          onclick={() => onSubmit(null)}
        />
      {/if}
    {/if}
  </OutlinedPanel>
</div>
