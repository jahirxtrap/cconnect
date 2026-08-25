<script lang="ts">
  import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
  import CornerDownRight from "@lucide/svelte/icons/corner-down-right";
  import Play from "@lucide/svelte/icons/play";
  import NotepadText from "@lucide/svelte/icons/notepad-text";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import {
    componentAnswerable,
    VALUE_SEPARATOR,
    type ComponentElement,
    type InteractionData,
  } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import { parseCconnectBlock } from "$lib/markdown/cconnectBlock";
  import { pixelGrid } from "$lib/ui/pixelGrid";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import CconnectBlockView from "$lib/ui/CconnectBlockView.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import OptionRow from "$lib/ui/OptionRow.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import SelectChip from "$lib/ui/SelectChip.svelte";
  import SummaryLine from "$lib/ui/SummaryLine.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import { componentIcon } from "$lib/ui/componentIcons";
  import { animateScrollLeft } from "$lib/ui/animateScroll";
  import { hscrollbar } from "$lib/ui/scrollbar";

  interface Props {
    data: InteractionData;
    onValue: (id: string, value: string) => void;
    onPick: (id: string, value: string, multiple: boolean) => void;
    onSubmit: (action: string | null) => void;
    onDismiss: () => void;
    onPage: (index: number) => void;
    onPreviewOpen: (url: string, filename: string) => void;
  }

  const { data, onValue, onPick, onSubmit, onDismiss, onPage, onPreviewOpen }: Props = $props();

  const flatten = (blocks: ComponentElement[]): ComponentElement[] =>
    blocks.flatMap((element) => (element.type === "page" ? flatten(element.blocks) : [element]));

  const valueOf = (element: ComponentElement) => data.values[element.id ?? ""] ?? "";

  const visible = (list: ComponentElement[]) =>
    list.filter((element) => {
      if (element.type === "text") return !!element.text?.trim();
      if (element.type === "preview") return !!element.block && !!parseCconnectBlock(element.block);
      return true;
    });

  const pages = $derived(data.blocks.filter((element) => element.type === "page"));
  const actions = $derived(data.blocks.find((element) => element.type === "buttons"));
  const answerable = $derived(componentAnswerable(data.blocks));

  const missing = (element: ComponentElement): boolean => {
    if (element.type === "page") {
      const answerable = flatten(element.blocks).filter((item) => item.type !== "notes");
      return (
        (element.required && !answerable.some((item) => valueOf(item))) ||
        element.blocks.some(missing)
      );
    }
    if (element.type === "buttons") return false;
    return element.required && !valueOf(element);
  };
  const ready = $derived(!data.blocks.some(missing));

  const keyed = (key: string | null, many = false) => {
    switch (key) {
      case "questions":
        return t("QUESTIONS_TITLE");
      case "submit":
        return many ? t("SUBMIT_ANSWERS") : t("SEND");
      case "chat":
        return t("CHAT_ABOUT_THIS");
      case "other":
        return t("INTERACTION_OTHER_HINT");
      case "notes":
        return t("INTERACTION_NOTES_HINT");
      case "add_notes":
        return t("ADD_NOTES");
      default:
        return null;
    }
  };

  const heading = $derived(keyed(data.titleKey) ?? data.title ?? "");
  const closable = $derived(!data.submitted && answerable && !data.dismiss);

  let page = $state(untrack(() => Math.max(data.activePage, 0)));
  const current = $derived(pages.length ? Math.min(page, pages.length - 1) : 0);
  const shown = $derived(pages.length ? (pages[current]?.blocks ?? []) : data.blocks);

  let pager = $state<HTMLDivElement | null>(null);
  let heights = $state<number[]>([]);
  let ratio = $state(0);
  let settling = false;
  let placed = false;

  const snapPx = (value: number) => {
    const grid = pixelGrid();
    return Math.round(value / grid) * grid;
  };

  const pageHeight = $derived.by(() => {
    if (!pages.length) return null;
    const spot = Math.min(Math.max(ratio, 0), pages.length - 1);
    const low = heights[Math.floor(spot)] ?? heights[current];
    const high = heights[Math.ceil(spot)] ?? low;
    if (low === undefined) return null;
    return snapPx(low + (high - low) * (spot - Math.floor(spot)));
  });

  const offsetOf = (node: HTMLDivElement, index: number) => {
    const child = node.children[index] as HTMLElement | undefined;
    if (!child) return index * node.clientWidth;
    return node.scrollLeft + child.getBoundingClientRect().left - node.getBoundingClientRect().left;
  };

  const goto = (index: number) => {
    const next = Math.min(Math.max(index, 0), pages.length - 1);
    const far = Math.abs(next - page) > 1;
    page = next;
    onPage(page);
    if (!pager) return;
    const target = offsetOf(pager, next);
    if (far) {
      pager.scrollLeft = target;
      return;
    }
    settling = true;
    void animateScrollLeft(pager, target).then(() => (settling = false));
  };

  const onPagerScroll = () => {
    if (!pager) return;
    ratio = pager.scrollLeft / pager.clientWidth;
    if (settling) return;
    const next = Math.round(ratio);
    if (next === page) return;
    page = next;
    onPage(page);
  };

  $effect(() => {
    const node = pager;
    if (!node || placed) return;
    placed = true;
    untrack(() => (node.scrollLeft = offsetOf(node, page)));
  });

  const openNotes = $state<Record<string, boolean>>({});
  const notesShown = (element: ComponentElement) =>
    openNotes[element.id ?? ""] ?? valueOf(element) !== "";

  const picked = (id: string | null) =>
    (data.values[id ?? ""] ?? "").split(VALUE_SEPARATOR).filter(Boolean);

  const dirty = $derived(Object.values(data.values).some((value) => value !== ""));
  let confirmingDismiss = $state(false);

  const pending = $derived(pages.length > 1 && current < pages.length - 1);
  const shownActions = $derived(
    (actions?.options ?? []).filter((option) => !pending || option.style === "plain"),
  );

  const summary = $derived(
    flatten(data.blocks).flatMap((element) => {
      const raw = valueOf(element);
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
      return value ? [{ label: element.label ?? "", value, note: element.type === "notes" }] : [];
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

{#snippet elements(list: ComponentElement[])}
  {#each visible(list) as element, index (index)}
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
    {:else if element.type === "select"}
      {#if element.label?.trim()}
        <p class="text-body-md">
          {element.label}{#if element.required}<span class="text-error"> *</span>{/if}
        </p>
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
          <OutlinedPanel class="w-full">
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
        label={element.label ?? undefined}
        required={element.required}
        value={valueOf(element)}
        oninput={(value) => !data.submitted && onValue(element.id ?? "", value)}
        placeholder={element.placeholder ?? keyed(element.placeholderKey) ?? undefined}
        singleLine={element.lines === null && !element.multiline}
        minLines={element.lines ?? 1}
        maxLines={element.lines ?? (element.multiline ? 6 : 1)}
        secret={element.secret}
      />
    {:else if element.type === "toggle"}
      <SwitchRow
        title={element.label ?? ""}
        required={element.required}
        checked={valueOf(element) === "true"}
        enabled={!data.submitted}
        onChange={(next) => onValue(element.id ?? "", String(next))}
      />
    {:else if element.type === "bar"}
      {@const percent = Number(element.value ?? 0)}
      <MetricBar
        title={element.label ?? ""}
        subtitle={element.text ?? ""}
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
            valueOf(element).trim()
              ? onValue(element.id ?? "", "")
              : (openNotes[element.id ?? ""] = false)}
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
{/snippet}

<div class="w-full px-4">
  <OutlinedPanel>
    {#if heading || closable}
      {@const Icon = componentIcon(data.icon) ?? (answerable ? CircleQuestionMark : null)}
      <div class="flex items-center gap-1.5">
        {#if heading}
          {#if Icon}
            <Icon size={16} class="shrink-0 text-accent" />
          {/if}
          <span class="min-w-0 flex-1 truncate text-label-lg text-accent select-none">{heading}</span>
        {:else}
          <span class="flex-1"></span>
        {/if}
        {#if closable}
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
    {/if}

    {#if data.declined}
      {@const icon = componentIcon(data.dismiss?.icon ?? null)}
      <SummaryLine
        icon={icon ?? X}
        text={data.dismiss ? (data.dismiss.label || (keyed(data.dismiss.labelKey) ?? "")) : t("CANCEL")}
      />
    {:else if data.submitted}
      {#each summary as row, index (index)}
        {#if row.note}
          <SummaryLine icon={CornerDownRight} size={12} text={row.value} class="mt-0.5 ml-4" />
        {:else}
          <div class="mt-0.5">
            {#if row.label}
              <p class="text-body-md">{row.label}</p>
            {/if}
            <SummaryLine icon={Play} fill text={row.value} />
          </div>
        {/if}
      {/each}
    {:else}
      {#if pages.length > 1}
        <div use:hscrollbar={{ touchIndicator: false }} class="no-scrollbar flex gap-2 overflow-x-auto">
          {#each pages as item, index (index)}
            <SelectChip
              label={item.label?.trim() || String(index + 1)}
              selected={index === current}
              required={item.required}
              onclick={() => goto(index)}
            />
          {/each}
        </div>
        <div class="mt-2.5 overflow-hidden" style={pageHeight === null ? "" : `height: ${pageHeight}px`}>
          <!-- The gap keeps the page being dragged clear of the next one instead of both touching. -->
          <div
            bind:this={pager}
            onscroll={onPagerScroll}
            class="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain"
          >
            {#each pages as item, index (index)}
              <div class="w-full shrink-0 snap-center self-start">
                <div bind:clientHeight={heights[index]} class="flex flex-col gap-1.5">
                  {@render elements(item.blocks)}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        {#if pages.length === 1 && pages[0].label?.trim()}
          <SelectChip label={pages[0].label} selected />
          <div class="h-1"></div>
        {/if}
        <div class="flex flex-col gap-1.5">
          {@render elements(shown)}
        </div>
      {/if}
    {/if}

    {#if !data.submitted && !data.declined}
      <div class="h-2"></div>
      {#if pending}
        <ActionButton class="w-full" text={t("NEXT")} onclick={() => goto(current + 1)} />
      {/if}
      {#if shownActions.length}
        <div class="flex flex-wrap gap-x-2 gap-y-1 {pending ? 'mt-2' : ''}">
          {#each shownActions as option (option.value)}
            {@const Icon = componentIcon(option.icon)}
            <Button
              variant={option.style === "primary" ? "filled" : "outlined"}
              class="h-8 text-body-md font-normal"
              enabled={ready || option.style === "plain"}
              onclick={() => onSubmit(option.value)}
            >
              {#if Icon}
                <Icon size={16} class="shrink-0" />
              {/if}
              {option.label || (keyed(option.labelKey, pages.length > 1) ?? "")}
            </Button>
          {/each}
        </div>
      {:else if !actions && !pending && answerable}
        <ActionButton
          class="w-full"
          text={data.submitLabel?.trim() ||
            keyed(data.submitKey, pages.length > 1) ||
            t("SEND")}
          enabled={ready}
          onclick={() => onSubmit(null)}
        />
      {/if}
      {#if data.dismiss}
        <ActionButton
          class="mt-2 w-full"
          text={data.dismiss.label || (keyed(data.dismiss.labelKey) ?? "")}
          icon={componentIcon(data.dismiss.icon) ?? undefined}
          onclick={() => (dirty ? (confirmingDismiss = true) : onDismiss())}
        />
      {/if}
    {/if}
  </OutlinedPanel>
</div>
