<script lang="ts">
  import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
  import CornerDownRight from "@lucide/svelte/icons/corner-down-right";
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import Play from "@lucide/svelte/icons/play";
  import { untrack } from "svelte";
  import type { InteractionData } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import OptionRow from "$lib/ui/OptionRow.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import SelectChip from "$lib/ui/SelectChip.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import { swipePage } from "$lib/ui/swipe";

  interface Props {
    data: InteractionData;
    onToggleOption: (questionIndex: number, optionId: string) => void;
    onFreeText: (questionIndex: number, value: string) => void;
    onNotes: (questionIndex: number, value: string) => void;
    onPage: (index: number) => void;
    onSubmit: () => void;
    onChat: () => void;
  }

  const { data, onToggleOption, onFreeText, onNotes, onPage, onSubmit, onChat }: Props = $props();

  const TAB_LABEL_MAX = 18;

  let page = $state(
    untrack(() => Math.min(Math.max(data.activeQuestion, 0), Math.max(data.questions.length - 1, 0))),
  );
  let showNotes = $state(untrack(() => (data.drafts[data.activeQuestion]?.notes ?? "") !== ""));

  const many = $derived(data.questions.length > 1);
  const question = $derived(data.questions[page]);
  const draft = $derived(data.drafts[page] ?? { selected: [], freeText: "", notes: "" });
  const hasPreview = $derived(question?.options.some((option) => option.preview?.trim()) ?? false);
  const isLast = $derived(page >= data.questions.length - 1);
  const canSend = $derived(many || !!draft.selected.length || !!draft.freeText.trim());

  const tabLabel = (index: number) => {
    const item = data.questions[index];
    return item.header?.trim() || item.question?.slice(0, TAB_LABEL_MAX).trim() || String(index + 1);
  };

  const goto = (index: number) => {
    page = index;
    showNotes = (data.drafts[index]?.notes ?? "") !== "";
    onPage(index);
  };
</script>

<div class="w-full px-4">
  <OutlinedPanel>
  <div class="flex items-center gap-1.5">
    <CircleQuestionMark size={16} class="shrink-0 text-accent" />
    <span class="text-label-lg text-accent select-none">{t("QUESTIONS_TITLE")}</span>
  </div>

  {#if data.declined}
    <div class="mt-0.5 flex items-center gap-1.5">
      <MessageSquare size={10} class="shrink-0 text-on-surface-variant" />
      <span class="text-body-sm text-on-surface-variant">{t("CHAT_ABOUT_THIS")}</span>
    </div>
  {:else if data.submitted}
    {#each data.questions as item, index (index)}
      <div class="mt-1">
        {#if item.header?.trim()}
          <SelectChip label={item.header} selected />
        {/if}
        {#if item.question?.trim()}
          <p class="mt-0.5 text-body-md">{item.question}</p>
        {/if}
        <div class="mt-0.5 flex items-center gap-1.5">
          <Play size={10} class="shrink-0 fill-current text-on-surface-variant" />
          <span class="text-body-sm text-on-surface-variant">{data.summary[index]?.trim() || "—"}</span>
        </div>
        {#if data.notes[index]?.trim()}
          <div class="mt-0.5 ml-4 flex items-center gap-1.5">
            <CornerDownRight size={12} class="shrink-0 text-on-surface-variant" />
            <span class="text-body-sm text-on-surface-variant">{data.notes[index]}</span>
          </div>
        {/if}
      </div>
    {/each}
  {:else}
    {#if many}
      <div
        use:hscrollbar={{ touchIndicator: false }}
        class="no-scrollbar mt-1 flex gap-2 overflow-x-auto"
      >
        {#each data.questions as _item, index (index)}
          <SelectChip label={tabLabel(index)} selected={index === page} onclick={() => goto(index)} />
        {/each}
      </div>
    {/if}

    {#if question}
      <div
        class="mt-1"
        use:swipePage={{
          onPrevious: () => goto(Math.max(0, page - 1)),
          onNext: () => goto(Math.min(data.questions.length - 1, page + 1)),
        }}
      >
        {#if !many && question.header?.trim()}
          <SelectChip label={question.header} selected />
        {/if}
        {#if question.question?.trim()}
          <p class="mt-1 text-body-md">{question.question}</p>
        {/if}

        <div class="mt-1.5 flex flex-col">
          {#each question.options as option (option.id)}
            {@const selected = draft.selected.includes(option.id)}
            <OptionRow
              label={option.label ?? option.id}
              onclick={() => onToggleOption(page, option.id)}
              description={option.description}
              {selected}
              multi={question.multiSelect}
            />
            {#if selected && option.preview?.trim()}
              <OutlinedPanel class="mb-1.5 ml-6">
                <MarkdownText text={option.preview} />
              </OutlinedPanel>
            {/if}
          {/each}
        </div>

        {#if !hasPreview}
          <InputField
            class="mt-1.5"
            value={draft.freeText}
            oninput={(value) => onFreeText(page, value)}
            placeholder={t("INTERACTION_OTHER_HINT")}
            maxLines={3}
            onClear={question.multiSelect ? () => onFreeText(page, "") : null}
          />
        {/if}

        {#if showNotes}
          <InputField
            class="mt-1.5"
            value={draft.notes}
            oninput={(value) => onNotes(page, value)}
            placeholder={t("INTERACTION_NOTES_HINT")}
            maxLines={3}
            clearAlways
            onClear={() => (draft.notes.trim() ? onNotes(page, "") : (showNotes = false))}
          />
        {:else}
          <button
            type="button"
            onclick={() => (showNotes = true)}
            class="mt-1 cursor-pointer text-label-md text-accent select-none"
          >
            {t("ADD_NOTES")}
          </button>
        {/if}
      </div>
    {/if}

    <ActionButton
      class="mt-1.5 w-full"
      text={!isLast ? t("NEXT") : many ? t("SUBMIT_ANSWERS") : t("SEND")}
      enabled={!isLast || canSend}
      onclick={() => (isLast ? onSubmit() : goto(page + 1))}
    />
    <ActionButton class="mt-2 w-full" text={t("CHAT_ABOUT_THIS")} icon={MessageSquare} onclick={onChat} />
  {/if}
  </OutlinedPanel>
</div>
