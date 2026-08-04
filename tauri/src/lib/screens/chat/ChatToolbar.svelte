<script lang="ts">
  import Gauge from "@lucide/svelte/icons/gauge";
  import History from "@lucide/svelte/icons/history";
  import Shield from "@lucide/svelte/icons/shield";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Zap from "@lucide/svelte/icons/zap";
  import type { Capabilities } from "$lib/services/capabilitiesApi";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { IconSource } from "$lib/ui/icons";

  interface Props {
    capabilities: Capabilities | null;
    model: string;
    effort: string;
    permissionMode: string;
    streamTokens: boolean;
    contextTokens: number | null;
    onModel: (value: string) => void;
    onEffort: (value: string) => void;
    onPermissionMode: (value: string) => void;
    onStreamTokens: () => void;
    onRewind: () => void;
  }

  const {
    capabilities,
    model,
    effort,
    permissionMode,
    streamTokens,
    contextTokens,
    onModel,
    onEffort,
    onPermissionMode,
    onStreamTokens,
    onRewind,
  }: Props = $props();

  const TOKENS_PER_K = 1000;

  let openMenu = $state<"model" | "effort" | "permission" | null>(null);

  const modelLabel = $derived(capabilities?.models.find((item) => item.id === model)?.label ?? model);
  const permissionLabel = $derived(
    capabilities?.permissionModes.find((item) => item.id === permissionMode)?.label ?? permissionMode,
  );
</script>

{#snippet selector(kind: "model" | "effort" | "permission", icon: IconSource, label: string)}
  {@const Icon = icon}
  <PopupMenu
    open={openMenu === kind}
    side="top"
    onOpenChange={(value) => (openMenu = value ? kind : null)}
  >
    {#snippet trigger()}
      <span
        class="flex cursor-pointer items-center gap-1.5 rounded-xs border border-outline-variant px-2 py-1 text-label-md"
      >
        <Icon size={14} class="shrink-0 text-accent" />
        <span class="max-w-32 truncate">{label}</span>
      </span>
    {/snippet}
    {#if kind === "model"}
      {#each capabilities?.models ?? [] as option (option.id)}
        <MenuItem
          text={option.label}
          selected={option.id === model}
          onclick={() => {
            onModel(option.id);
            openMenu = null;
          }}
        />
      {/each}
    {:else if kind === "effort"}
      {#each capabilities?.effortLevels ?? [] as option (option)}
        <MenuItem
          text={option}
          selected={option === effort}
          onclick={() => {
            onEffort(option);
            openMenu = null;
          }}
        />
      {/each}
    {:else}
      {#each capabilities?.permissionModes ?? [] as option (option.id)}
        <MenuItem
          text={option.label}
          selected={option.id === permissionMode}
          onclick={() => {
            onPermissionMode(option.id);
            openMenu = null;
          }}
        />
      {/each}
    {/if}
  </PopupMenu>
{/snippet}

<div class="flex items-center gap-1.5 overflow-x-auto px-3 pt-1.5">
  {@render selector("model", Sparkles, modelLabel)}
  {@render selector("effort", Gauge, effort)}
  {@render selector("permission", Shield, permissionLabel)}

  <TooltipIconButton label={t("STREAMING")} onclick={onStreamTokens} class="size-8">
    <Zap size={16} class={streamTokens ? "text-accent" : "text-on-surface-variant"} />
  </TooltipIconButton>

  <TooltipIconButton label={t("REWIND")} onclick={onRewind} class="size-8">
    <History size={16} class="text-on-surface-variant" />
  </TooltipIconButton>

  <div class="flex-1"></div>

  {#if contextTokens !== null}
    <span class="shrink-0 text-label-md text-on-surface-variant">
      {Math.round(contextTokens / TOKENS_PER_K)}k
    </span>
  {/if}
</div>
