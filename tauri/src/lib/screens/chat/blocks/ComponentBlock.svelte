<script lang="ts">
  import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
  import CornerDownRight from "@lucide/svelte/icons/corner-down-right";
  import Play from "@lucide/svelte/icons/play";
  import X from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";
  import {
    componentAnswerable,
    componentBlocked,
    componentHiddenIds,
    componentLeaves,
    VALUE_SEPARATOR,
    type ComponentConfirm,
    type ComponentElement,
    type InteractionData,
  } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import { ceilPx, gridHeight } from "$lib/ui/pixelGrid";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import SelectChip from "$lib/ui/SelectChip.svelte";
  import SummaryLine from "$lib/ui/SummaryLine.svelte";
  import { componentIcon } from "$lib/ui/componentIcons";
  import { animateScrollLeft } from "$lib/ui/animateScroll";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import ComponentElements from "./ComponentElements.svelte";
  import { keyed } from "./componentKeys";

  interface Props {
    data: InteractionData;
    colors: string[];
    onGrow: (grow: () => void, anchor: HTMLElement | null) => void;
    onValue: (id: string, value: string) => void;
    onPick: (id: string, value: string, multiple: boolean) => void;
    onSubmit: (action: string | null) => void;
    onDismiss: (via: "button" | "close") => void;
    onPage: (index: number) => void;
    onPreviewOpen: (url: string, filename: string) => void;
    onUpload: (file: File, onProgress: (value: number) => void) => Promise<string | null>;
  }

  const { data, colors, onGrow, onValue, onPick, onSubmit, onDismiss, onPage, onPreviewOpen, onUpload }: Props =
    $props();

  const pages = $derived(data.blocks.filter((element) => element.type === "page"));
  const actions = $derived(data.blocks.find((element) => element.type === "buttons"));
  const answerable = $derived(componentAnswerable(data.blocks));
  const ready = $derived(!componentBlocked(data.blocks, data.values));
  const open = $derived(!data.submitted && !data.declined);
  const asDialog = $derived(data.present === "dialog" && open && answerable);

  const heading = $derived(keyed(data.titleKey) ?? data.title ?? "");
  const closable = $derived(open && answerable);

  let page = $state(untrack(() => Math.max(data.activePage, 0)));
  const current = $derived(pages.length ? Math.min(page, pages.length - 1) : 0);
  const shown = $derived(pages.length ? (pages[current]?.blocks ?? []) : data.blocks);

  const SCROLL_END = "onscrollend" in window;
  const SETTLE_MS = 120;

  let pager = $state<HTMLDivElement | null>(null);
  let heights = $state<number[]>([]);
  let ratio = $state(0);
  let sliding = $state(false);
  let slideTimer: ReturnType<typeof setTimeout> | null = null;
  let settling = false;
  let placed = false;

  const stopSliding = () => {
    slideTimer = null;
    sliding = false;
  };

  const pageHeight = $derived.by(() => {
    if (!pages.length) return null;
    if (!sliding) return heights[current] ?? null;
    const spot = Math.min(Math.max(ratio, 0), pages.length - 1);
    const low = heights[Math.floor(spot)] ?? heights[current];
    const high = heights[Math.ceil(spot)] ?? low;
    if (low === undefined) return null;
    return ceilPx(low + (high - low) * (spot - Math.floor(spot)));
  });

  const offsetOf = (node: HTMLDivElement, index: number) => {
    const child = node.children[index] as HTMLElement | undefined;
    if (!child) return index * node.clientWidth;
    return node.scrollLeft + child.getBoundingClientRect().left - node.getBoundingClientRect().left;
  };

  const stepOf = (node: HTMLDivElement) =>
    (node.children.length > 1 ? offsetOf(node, 1) - offsetOf(node, 0) : 0) || node.clientWidth || 1;

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
    ratio = pager.scrollLeft / stepOf(pager);
    sliding = true;
    if (!SCROLL_END) {
      if (slideTimer !== null) clearTimeout(slideTimer);
      slideTimer = setTimeout(stopSliding, SETTLE_MS);
    }
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
    untrack(() => {
      node.scrollLeft = offsetOf(node, page);
      ratio = page;
    });
  });

  const pending = $derived(pages.length > 1 && current < pages.length - 1);
  const shownActions = $derived((actions?.options ?? []).filter((option) => !pending || option.style === "plain"));

  let asking = $state<{ confirm: ComponentConfirm; run: () => void } | null>(null);

  const act = (confirm: ComponentConfirm | null, run: () => void) => {
    if (confirm) asking = { confirm, run };
    else run();
  };

  const close = () =>
    (asking = {
      confirm: { title: t("CANCEL"), text: t("COMPONENT_DISCARD_CONFIRM"), confirmLabel: t("DISCARD") },
      run: () => onDismiss("close"),
    });

  const shownValue = (element: ComponentElement, raw: string) => {
    if (element.secret) return "•".repeat(Math.min(raw.length, 12));
    if (element.type === "select" || element.type === "buttons") {
      return raw
        .split(VALUE_SEPARATOR)
        .filter(Boolean)
        .map((item) => element.options.find((option) => option.value === item)?.label ?? item)
        .join(", ");
    }
    if (element.type === "toggle") return raw === "true" ? t("YES") : t("NO");
    if (element.type === "file") {
      return raw
        .split(VALUE_SEPARATOR)
        .filter(Boolean)
        .map((path) => path.split(/[\\/]/).pop() ?? path)
        .join(", ");
    }
    return raw;
  };

  const hidden = $derived(componentHiddenIds(data.blocks, data.values));

  const summary = $derived(
    componentLeaves(data.blocks).flatMap((element) => {
      const raw = data.values[element.id ?? ""] ?? "";
      if (!element.id || !raw || hidden.has(element.id)) return [];
      const value = shownValue(element, raw);
      return value ? [{ label: element.label ?? "", value, note: element.type === "notes" }] : [];
    }),
  );
</script>

{#if asking}
  {@const item = asking}
  <ConfirmDialog
    title={item.confirm.title ?? t("CONFIRM")}
    text={item.confirm.text}
    confirmLabel={item.confirm.confirmLabel ?? t("CONFIRM")}
    onConfirm={() => {
      const run = item.run;
      asking = null;
      run();
    }}
    onDismiss={() => (asking = null)}
  />
{/if}

{#snippet fields(list: ComponentElement[])}
  <ComponentElements {list} {data} {colors} {onGrow} {onValue} {onPick} {onPreviewOpen} {onUpload} />
{/snippet}

{#snippet body()}
  {#if data.declined}
    {@const byButton = data.dismissedBy === "button" && !!data.dismiss}
    <SummaryLine
      icon={(byButton ? componentIcon(data.dismiss?.icon ?? null) : null) ?? X}
      text={byButton ? (data.dismiss?.label || (keyed(data.dismiss?.labelKey ?? null) ?? "")) : t("CANCEL")}
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
  {:else if pages.length > 1}
    <div use:hscrollbar class="no-scrollbar flex gap-2 overflow-x-auto">
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
      <div
        bind:this={pager}
        onscroll={onPagerScroll}
        onscrollend={stopSliding}
        style="gap: var(--chat-pager-gap-snap, var(--chat-pager-gap))"
        class="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {#each pages as item, index (index)}
          <div class="w-full shrink-0 snap-center self-start">
            <div use:gridHeight={(value) => (heights[index] = value)} class="chat-gap flex flex-col">
              {@render fields(item.blocks)}
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
    <div class="chat-gap flex flex-col">
      {@render fields(shown)}
    </div>
  {/if}
{/snippet}

{#snippet controls(inline: boolean)}
  {#if pending}
    {#if inline}
      <ActionButton class="w-full" text={t("NEXT")} onclick={() => goto(current + 1)} />
    {:else}
      <Button onclick={() => goto(current + 1)}>{t("NEXT")}</Button>
    {/if}
  {/if}
  {#if shownActions.length}
    <div class="flex flex-wrap gap-x-2 gap-y-1 {pending ? 'mt-2' : ''}">
      {#each shownActions as option (option.value)}
        {@const Icon = componentIcon(option.icon)}
        <Button
          variant={option.style === "primary" ? "filled" : "outlined"}
          class="h-8 text-body-md font-normal"
          enabled={ready || option.style === "plain"}
          onclick={() => act(option.confirm, () => onSubmit(option.value))}
        >
          {#if Icon}
            <Icon size={16} class="shrink-0" />
          {/if}
          {option.label || (keyed(option.labelKey, pages.length > 1) ?? "")}
        </Button>
      {/each}
    </div>
  {:else if !actions && !pending && answerable}
    {@const label = data.submitLabel?.trim() || keyed(data.submitKey, pages.length > 1) || t("SEND")}
    {#if inline}
      <ActionButton class="w-full" text={label} enabled={ready} onclick={() => onSubmit(null)} />
    {:else}
      <Button enabled={ready} onclick={() => onSubmit(null)}>{label}</Button>
    {/if}
  {/if}
  {#if data.dismiss}
    {@const label = data.dismiss.label || (keyed(data.dismiss.labelKey) ?? "")}
    {#if inline}
      <ActionButton
        class="mt-2 w-full"
        text={label}
        icon={componentIcon(data.dismiss.icon) ?? undefined}
        onclick={() => act(data.dismiss?.confirm ?? null, () => onDismiss("button"))}
      />
    {:else}
      <Button variant="outlined" onclick={() => act(data.dismiss?.confirm ?? null, () => onDismiss("button"))}>{label}</Button>
    {/if}
  {/if}
{/snippet}

{#if asDialog}
  <CompactDialog title={heading || t("QUESTIONS_TITLE")} onDismiss={close}>
    {#snippet buttons()}
      {@render controls(false)}
    {/snippet}
    <div class="chat-gap flex flex-col">
      {@render body()}
    </div>
  </CompactDialog>
{:else}
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
              onclick={close}
              aria-label={t("CANCEL")}
              class="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
            >
              <X size={16} />
            </button>
          {/if}
        </div>
        <div class="h-1"></div>
      {/if}

      {@render body()}

      {#if open}
        <div class="h-2"></div>
        {@render controls(true)}
      {/if}
    </OutlinedPanel>
  </div>
{/if}
