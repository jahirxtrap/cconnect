<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Gauge from "@lucide/svelte/icons/gauge";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Radio from "@lucide/svelte/icons/radio";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import { t } from "$lib/i18n/index.svelte";
  import type { Capabilities } from "$lib/services/capabilitiesApi";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ContextRing from "./ContextRing.svelte";
  import { permissionStyle } from "./permissionStyle";

  interface Props {
    capabilities: Capabilities | null;
    ready: boolean;
    connecting: boolean;
    disconnected: boolean;
    model: string;
    modelSelected: string;
    effort: string;
    effortSelected: string;
    permissionMode: string;
    permissionSelected: string;
    streamTokens: boolean;
    contextTokens: number | null;
    quickChatActive: boolean;
    onModel: (value: string) => void;
    onEffort: (value: string) => void;
    onPermissionMode: (value: string) => void;
    onStreamTokens: () => void;
    onQuickChat: () => void;
    quickChatEnabled: boolean;
  }

  const {
    capabilities,
    ready,
    connecting,
    disconnected,
    model,
    modelSelected,
    effort,
    effortSelected,
    permissionMode,
    permissionSelected,
    streamTokens,
    contextTokens,
    quickChatActive,
    onModel,
    onEffort,
    onPermissionMode,
    onStreamTokens,
    onQuickChat,
    quickChatEnabled,
  }: Props = $props();

  const CONTEXT_LIMIT_LARGE = 1_000_000;
  const CONTEXT_LIMIT = 200_000;
  const ITEM_CLASS =
    "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-label-lg transition-colors hover:bg-on-surface/8";
  const STATE_CLASS = "flex h-8 shrink-0 items-center gap-1.5 px-2 text-label-lg text-on-surface-variant";

  let openMenu = $state<"model" | "effort" | "permission" | null>(null);

  const serverOption = { value: "", label: t("SERVER_DEFAULT") };

  const modelOptions = $derived([
    serverOption,
    ...(capabilities?.models ?? []).map((item) => ({ value: item.id, label: item.label })),
  ]);
  const effortOptions = $derived([
    serverOption,
    ...(capabilities?.effortLevels ?? []).map((value) => ({ value, label: value })),
  ]);
  const permissionOptions = $derived([
    serverOption,
    ...(capabilities?.permissionModes ?? []).map((item) => ({ value: item.id, label: item.label })),
  ]);

  const modelLabel = $derived(capabilities?.models.find((item) => item.id === model)?.label ?? model);
  const permissionLabel = $derived(
    capabilities?.permissionModes.find((item) => item.id === permissionMode)?.label ?? permissionMode,
  );
  const permission = $derived(permissionStyle(permissionMode));
</script>

<div class="relative flex h-8 shrink-0 items-center">
  <TooltipIconButton
    label={t("QUICK_CHAT")}
    enabled={quickChatEnabled}
    onclick={onQuickChat}
    class="size-8"
  >
    <MessagesSquare size={18} class="text-accent" />
  </TooltipIconButton>
  {#if quickChatActive}
    <span class="pointer-events-none absolute top-0 right-0 size-[7px] rounded-full bg-accent"></span>
  {/if}
</div>

{#if disconnected}
  <span class={STATE_CLASS}>
    <StatusDot class="bg-red" />
    {t("DISCONNECTED")}
  </span>
{:else if connecting || !ready}
  <span class={STATE_CLASS}>
    <span class="size-3.5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
    {connecting ? t("CONNECTING") : t("LOADING")}
  </span>
{:else}
  <PopupMenu open={openMenu === "model"} side="top" onOpenChange={(open) => (openMenu = open ? "model" : null)}>
    {#snippet trigger()}
      <span class={ITEM_CLASS}>
        <Sparkles size={18} class="shrink-0 text-accent" />
        <span class="max-w-40 truncate">{modelLabel}</span>
        <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
      </span>
    {/snippet}
    {#each modelOptions as option (option.value)}
      <MenuItem
        text={option.label}
        selected={option.value === modelSelected}
        onclick={() => {
          onModel(option.value);
          openMenu = null;
        }}
      />
    {/each}
  </PopupMenu>

  <PopupMenu open={openMenu === "effort"} side="top" onOpenChange={(open) => (openMenu = open ? "effort" : null)}>
    {#snippet trigger()}
      <span class={ITEM_CLASS}>
        <Gauge size={18} class="shrink-0 text-accent" />
        <span class="max-w-24 truncate">{effort}</span>
        <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
      </span>
    {/snippet}
    {#each effortOptions as option (option.value)}
      <MenuItem
        text={option.label}
        selected={option.value === effortSelected}
        onclick={() => {
          onEffort(option.value);
          openMenu = null;
        }}
      />
    {/each}
  </PopupMenu>

  <PopupMenu
    open={openMenu === "permission"}
    side="top"
    onOpenChange={(open) => (openMenu = open ? "permission" : null)}
  >
    {#snippet trigger()}
      <span class={ITEM_CLASS}>
        <permission.icon size={18} class="shrink-0 {permission.tone}" />
        <span class="max-w-32 truncate">{permissionLabel}</span>
        <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
      </span>
    {/snippet}
    {#each permissionOptions as option (option.value)}
      {@const style = permissionStyle(option.value || permissionMode)}
      <MenuItem
        text={option.label}
        selected={option.value === permissionSelected}
        onclick={() => {
          onPermissionMode(option.value);
          openMenu = null;
        }}
      >
        {#snippet leading()}
          <style.icon size={18} class="shrink-0 {style.tone}" />
        {/snippet}
      </MenuItem>
    {/each}
  </PopupMenu>

  <TooltipIconButton label={t("STREAMING")} onclick={onStreamTokens} class="size-8">
    <Radio size={18} class={streamTokens ? "text-green" : "text-on-surface-variant"} />
  </TooltipIconButton>

  {#if contextTokens !== null && contextTokens > 0}
    <ContextRing tokens={contextTokens} limit={model.includes("1m") ? CONTEXT_LIMIT_LARGE : CONTEXT_LIMIT} />
  {/if}
{/if}
