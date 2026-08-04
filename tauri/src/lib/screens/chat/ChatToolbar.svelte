<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import History from "@lucide/svelte/icons/history";
  import Radio from "@lucide/svelte/icons/radio";
  import { t } from "$lib/i18n/index.svelte";
  import type { Capabilities } from "$lib/services/capabilitiesApi";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ContextRing from "./ContextRing.svelte";

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

  const CONTEXT_LIMIT_LARGE = 1_000_000;
  const CONTEXT_LIMIT = 200_000;
  const TRIGGER_CLASS =
    "flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-label-lg text-on-surface-variant transition-colors hover:bg-on-surface/8";

  let openMenu = $state<"model" | "effort" | "permission" | null>(null);

  const modelLabel = $derived(capabilities?.models.find((item) => item.id === model)?.label ?? model);
  const permissionLabel = $derived(
    capabilities?.permissionModes.find((item) => item.id === permissionMode)?.label ?? permissionMode,
  );
</script>

<PopupMenu open={openMenu === "model"} side="top" onOpenChange={(open) => (openMenu = open ? "model" : null)}>
  {#snippet trigger()}
    <span class={TRIGGER_CLASS}>
      <span class="max-w-40 truncate text-on-surface">{modelLabel}</span>
      <ChevronDown size={14} class="shrink-0" />
    </span>
  {/snippet}
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
</PopupMenu>

<PopupMenu open={openMenu === "effort"} side="top" onOpenChange={(open) => (openMenu = open ? "effort" : null)}>
  {#snippet trigger()}
    <span class={TRIGGER_CLASS}>
      <span class="truncate">{effort}</span>
      <ChevronDown size={14} class="shrink-0" />
    </span>
  {/snippet}
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
</PopupMenu>

<PopupMenu open={openMenu === "permission"} side="top" onOpenChange={(open) => (openMenu = open ? "permission" : null)}>
  {#snippet trigger()}
    <span class={TRIGGER_CLASS}>
      <span class="max-w-32 truncate">{permissionLabel}</span>
      <ChevronDown size={14} class="shrink-0" />
    </span>
  {/snippet}
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
</PopupMenu>

<TooltipIconButton label={t("STREAMING")} onclick={onStreamTokens} class="size-8">
  <Radio size={15} class={streamTokens ? "text-green" : "text-on-surface-variant"} />
</TooltipIconButton>

<TooltipIconButton label={t("REWIND")} onclick={onRewind} class="size-8">
  <History size={15} class="text-on-surface-variant" />
</TooltipIconButton>

{#if contextTokens !== null && contextTokens > 0}
  <ContextRing
    tokens={contextTokens}
    limit={model.includes("1m") ? CONTEXT_LIMIT_LARGE : CONTEXT_LIMIT}
  />
{/if}
