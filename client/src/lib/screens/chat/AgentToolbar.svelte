<script lang="ts">
  import Gauge from "@lucide/svelte/icons/gauge";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import Shield from "@lucide/svelte/icons/shield";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import ToggleLeft from "@lucide/svelte/icons/toggle-left";
  import ToggleRight from "@lucide/svelte/icons/toggle-right";
  import { agentUp, chosenName, type AgentOption, type AgentState } from "$lib/data/agentModels";
  import type { ConnectionState } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import type { IconSource } from "$lib/ui/icons";
  import { LINK_LOOKS } from "$lib/ui/linkStatus";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import { hscrollbar, SCROLL_ROW_CLASS } from "$lib/ui/scrollbar";
  import { SECTION_LABEL_CLASS } from "$lib/ui/sectionLabel";
  import ContextRing from "./ContextRing.svelte";
  import { CHIP_ICON_SIZE } from "./toolbarChips";
  import ToolbarSelect from "./ToolbarSelect.svelte";
  import ToolbarState from "./ToolbarState.svelte";
  import ToolbarToggle from "./ToolbarToggle.svelte";
  import VisibilityToggle from "./VisibilityToggle.svelte";

  interface Props {
    agent: AgentState | null;
    link: ConnectionState;
    loading: boolean;
    contextTokens: number | null;
    contextWindow: number | null;
    simpleMode: boolean;
    onOption: (id: string, value: string | boolean) => void;
    onVisibility: () => void;
  }

  const { agent, link, loading, contextTokens, contextWindow, simpleMode, onOption, onVisibility }: Props = $props();

  const CATEGORY_ICONS: Record<string, IconSource> = {
    model: Sparkles,
    thought_level: Gauge,
    mode: Shield,
  };

  const iconOf = (option: AgentOption): IconSource => CATEGORY_ICONS[option.category] ?? SlidersHorizontal;
  const labelOf = (option: AgentOption): string => option.name || t("AGENT_MODE");
  const ready = $derived(link === "connected" && agent?.status === "ready");
  const limit = $derived(contextWindow ?? agent?.usage?.size ?? null);
</script>

<div class="flex h-full min-w-0 flex-1 items-stretch">
<div
  use:hscrollbar={{ wheel: true }}
  class="{SCROLL_ROW_CLASS} flex min-w-0 flex-1 items-center gap-1.5 pl-0.5"
>
  {#if link === "disconnected"}
    <ToolbarState text={t(LINK_LOOKS.disconnected.text)} dot={LINK_LOOKS.disconnected.dot} />
  {:else if link === "connecting" || !agent || agent.status === "connecting"}
    <ToolbarState text={t(LINK_LOOKS.connecting.text)} loading />
  {:else if agent.status === "auth"}
    <ToolbarState text={t("AGENT_SIGN_IN_NEEDED")} icon={KeyRound} />
  {:else if !agentUp(agent.status)}
    <ToolbarState text={t("AGENT_UNAVAILABLE")} dot="bg-red" />
  {:else}
    {#each agent.options as option (option.id)}
      {#if option.type === "boolean"}
        <ToolbarToggle
          label={labelOf(option)}
          pressed={option.current === true}
          tinted={false}
          onclick={() => onOption(option.id, option.current !== true)}
        >
          {#if option.current === true}
            <ToggleRight size={CHIP_ICON_SIZE} class="text-accent" />
          {:else}
            <ToggleLeft size={CHIP_ICON_SIZE} class="text-on-surface-variant" />
          {/if}
        </ToolbarToggle>
      {:else}
        <ToolbarSelect label={labelOf(option)} icon={iconOf(option)} text={chosenName(option)}>
          {#each option.choices as choice, index (choice.value)}
            {#if choice.group && choice.group !== option.choices[index - 1]?.group}
              <p class="px-2.5 pt-1.5 pb-1 {SECTION_LABEL_CLASS}">{choice.group}</p>
            {/if}
            <MenuItem
              text={choice.name}
              description={choice.description}
              selected={choice.value === option.current}
              onclick={() => onOption(option.id, choice.value)}
            />
          {/each}
        </ToolbarSelect>
      {/if}
    {/each}
  {/if}
  {#if link === "connected"}
    <VisibilityToggle {simpleMode} {onVisibility} />
  {/if}
</div>

{#if ready && !loading && limit !== null}
  <ContextRing
    tokens={contextTokens ?? agent?.usage?.used ?? 0}
    {limit}
    cache={null}
    bytes={null}
    totalBytes={null}
    byteLimit={null}
    limits={[]}
    cost={agent?.usage?.cost ?? null}
  />
{/if}
</div>
