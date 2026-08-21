<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Play from "@lucide/svelte/icons/play";
  import Shield from "@lucide/svelte/icons/shield";
  import type { InteractionData, InteractionOption } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";

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
  };

  const optionLabel = (option: InteractionOption) =>
    option.label?.trim() ? option.label : DEFAULT_LABELS[option.id] ? t(DEFAULT_LABELS[option.id]) : option.id;

  const isPlan = $derived(toolName === "ExitPlanMode");
  const title = $derived(isPlan ? t("PLAN") : (data.title ?? toolName ?? t("PERMISSION_TITLE")));
  const preview = $derived(
    isPlan ? (input.split("\n").find((line) => line.trim())?.replace(/^#+\s*/, "").trim() ?? "") : "",
  );
  const chosen = $derived(data.options.find((option) => option.id === data.resolved));

  let localExpanded = $state(false);

  const isExpanded = $derived(expanded ?? localExpanded);

  const toggle = () => {
    if (onToggle) onToggle();
    else localExpanded = !localExpanded;
  };
</script>

<div class="w-full px-4">
  {#snippet header()}
    {#if isPlan}
      <Lightbulb size={16} class="shrink-0 text-accent" />
    {:else}
      <Shield size={16} class="shrink-0 text-accent" />
    {/if}
    <span class="min-w-0 flex-1 truncate text-label-lg text-accent select-none">
      {title}
      {#if isPlan && !isExpanded && preview}
        <span class="text-on-surface-variant">&nbsp;&nbsp;{preview}</span>
      {/if}
    </span>
    {#if isPlan}
      {#if isExpanded}
        <ChevronDown size={18} class="shrink-0 text-on-surface-variant" />
      {:else}
        <ChevronRight size={18} class="shrink-0 text-on-surface-variant" />
      {/if}
    {/if}
  {/snippet}

  <OutlinedPanel>
  {#if isPlan}
    <button
      type="button"
      onclick={toggle}
      class="flex w-full cursor-pointer items-center gap-2 text-left"
    >
      {@render header()}
    </button>
  {:else}
    <div class="flex w-full items-center gap-2">{@render header()}</div>
  {/if}

  {#if input.trim()}
    {#if isPlan}
      {#if isExpanded}
        <div class="mt-1.5">
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
          class="h-8 text-body-md"
          onclick={() => onAnswer(data.requestId, option.id)}
        >
          {optionLabel(option)}
        </Button>
      {/each}
    </div>
  {:else}
    <div class="mt-1 flex items-center gap-1.5">
      <Play size={10} class="shrink-0 fill-current text-on-surface-variant" />
      <p class="min-w-0 flex-1 text-body-sm text-on-surface-variant">
        {chosen ? optionLabel(chosen) : data.resolved}
      </p>
    </div>
  {/if}
  </OutlinedPanel>
</div>
