<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Play from "@lucide/svelte/icons/play";
  import Puzzle from "@lucide/svelte/icons/puzzle";
  import Shield from "@lucide/svelte/icons/shield";
  import type { InteractionData, InteractionOption } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import SummaryLine from "$lib/ui/SummaryLine.svelte";

  interface Props {
    data: InteractionData;
    toolName: string | null;
    input: string;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    onAnswer: (requestId: string, optionId: string) => void;
  }

  const { data, toolName, input, expanded = null, onToggle = null, onAnswer }: Props = $props();

  const DEFAULT_LABELS: Record<string, string> = {
    allow: "PERMISSION_ALLOW",
    allow_always: "PERMISSION_ALLOW_ALWAYS",
    deny: "PERMISSION_DENY",
    different: "PERMISSION_DIFFERENT",
    enable: "MOD_HOT_RELOAD_ENABLE",
    decline: "MOD_HOT_RELOAD_DECLINE",
    explain: "MOD_HOT_RELOAD_EXPLAIN",
  };

  const MOD_BODIES: Record<string, string> = {
    now: "MOD_HOT_RELOAD_NOW",
    turn: "MOD_HOT_RELOAD_TURN",
    more: "MOD_HOT_RELOAD_MORE",
  };

  const optionLabel = (option: InteractionOption) =>
    option.label?.trim() ? option.label : DEFAULT_LABELS[option.id] ? t(DEFAULT_LABELS[option.id]) : option.id;

  const isPlan = $derived(toolName === "ExitPlanMode");
  const isMods = $derived(data.kind === "mods");
  const title = $derived(
    isPlan ? t("PLAN") : isMods ? t("MODS") : (data.title ?? toolName ?? t("PERMISSION_TITLE")),
  );
  const preview = $derived(
    isPlan ? (input.split("\n").find((line) => line.trim())?.replace(/^#+\s*/, "").trim() ?? "") : "",
  );
  const chosen = $derived(data.options.find((option) => option.id === data.resolved));

  let localExpanded = $state(false);

  const isExpanded = $derived(expanded ?? localExpanded);

  const showsPreview = $derived(isPlan && !isExpanded && preview !== "");

  const toggle = () => {
    if (onToggle) onToggle();
    else localExpanded = !localExpanded;
  };
</script>

<div class="w-full px-(--page-inset)">
  {#snippet header()}
    {#if isPlan}
      <Lightbulb size={16} class="shrink-0 text-accent" />
    {:else if isMods}
      <Puzzle size={16} class="shrink-0 text-accent" />
    {:else}
      <Shield size={16} class="shrink-0 text-accent" />
    {/if}
    <span
      class="min-w-0 flex-1 truncate text-label-lg select-none {showsPreview
        ? 'text-on-surface-variant'
        : 'text-accent'}"
    >
      <span class={showsPreview ? "text-accent" : ""}>{title}</span>
      {#if showsPreview}&nbsp;&nbsp;{preview}{/if}
    </span>
    {#if isPlan}
      {#if isExpanded}
        <ChevronDown size={18} class="shrink-0 text-on-surface-variant" />
      {:else}
        <ChevronRight size={18} class="shrink-0 text-on-surface-variant" />
      {/if}
    {/if}
  {/snippet}

  <CardPanel>
  {#if isPlan}
    <button
      type="button"
      onclick={toggle}
      class="flex w-full cursor-pointer items-center gap-2 rounded-md text-left transition-colors select-none hover:bg-hover"
    >
      {@render header()}
    </button>
  {:else}
    <div class="flex w-full items-center gap-1.5">{@render header()}</div>
  {/if}

  {#if isMods}
    <p class="mt-1 text-body-md">{t("MOD_HOT_RELOAD_QUESTION")}</p>
    <p class="mt-1 text-body-md whitespace-pre-line text-on-surface-variant">
      {t(MOD_BODIES[data.variant ?? ""] ?? MOD_BODIES.turn)}
    </p>
  {:else if input.trim()}
    {#if isPlan}
      {#if isExpanded}
        <div class="pt-1.5">
          <MarkdownText text={input} />
        </div>
      {/if}
    {:else}
      <p class="mt-1 font-mono text-body-sm wrap-anywhere whitespace-pre-wrap text-on-surface-variant">{input}</p>
    {/if}
  {/if}

  {#if data.resolved === null}
    <div class="mt-2 flex flex-wrap gap-2">
      {#each data.options as option (option.id)}
        <Button
          variant="outlined"
          onclick={() => onAnswer(data.requestId, option.id)}
        >
          {optionLabel(option)}
        </Button>
      {/each}
    </div>
  {:else}
    <SummaryLine icon={Play} fill text={chosen ? optionLabel(chosen) : (data.resolved ?? "")} class="mt-1" />
  {/if}
  </CardPanel>
</div>
