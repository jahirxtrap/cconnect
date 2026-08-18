<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import Gauge from "@lucide/svelte/icons/gauge";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Radio from "@lucide/svelte/icons/radio";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import { t } from "$lib/i18n/index.svelte";
  import type { Capabilities } from "$lib/services/capabilitiesApi";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipWrap from "$lib/ui/TooltipWrap.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";
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
    account: string;
    accountSelected: string;
    onAccount: (value: string) => void;
    streamTokens: boolean;
    contextTokens: number | null;
    quickChatActive: boolean;
    onModel: (value: string) => void;
    onEffort: (value: string) => void;
    onPermissionMode: (value: string) => void;
    onStreamTokens: () => void;
    onQuickChat: () => void;
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
    account,
    accountSelected,
    onAccount,
    streamTokens,
    contextTokens,
    quickChatActive,
    onModel,
    onEffort,
    onPermissionMode,
    onStreamTokens,
    onQuickChat,
  }: Props = $props();

  const CONTEXT_LIMIT_LARGE = 1_000_000;
  const CONTEXT_LIMIT = 200_000;
  const ITEM_CLASS =
    "flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-surface-variant px-2.5 py-1 text-label-md ripple";
  const STATE_CLASS =
    "flex shrink-0 cursor-default items-center gap-1 rounded-md bg-surface-variant px-2.5 py-1 text-label-md";
  const TOGGLE_CLASS =
    "flex h-full shrink-0 cursor-pointer items-center rounded-md bg-surface-variant px-2 py-1 ripple";

  let openMenu = $state<"model" | "effort" | "permission" | "account" | null>(null);

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
  const accountOptions = $derived([
    serverOption,
    ...(capabilities?.accounts ?? []).map((item) => ({ value: item.id, label: item.label })),
  ]);
  const accountLabel = $derived(
    capabilities?.accounts?.find((item) => item.id === account)?.label ?? account,
  );

  const modelLabel = $derived(capabilities?.models.find((item) => item.id === model)?.label ?? model);
  const permissionLabel = $derived(
    capabilities?.permissionModes.find((item) => item.id === permissionMode)?.label ?? permissionMode,
  );
  const permission = $derived(permissionStyle(permissionMode));
</script>

<div class="flex h-full min-w-0 flex-1 items-center">
<TooltipWrap label={t("QUICK_CHAT")} class="relative flex h-full shrink-0 items-stretch pl-0.5">
  <button type="button" onclick={onQuickChat} aria-label={t("QUICK_CHAT")} class={TOGGLE_CLASS}>
    <MessagesSquare size={16} class="text-accent" />
  </button>
  {#if quickChatActive}
    <span class="pointer-events-none absolute top-0 right-0 size-[7px] rounded-full bg-accent"></span>
  {/if}
</TooltipWrap>

<div
  use:hscrollbar={{ touchIndicator: false, wheel: true, gutter: false }}
  class="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-0.5 pl-1.5"
>
  {#if disconnected}
    <span class={STATE_CLASS}>
      <StatusDot class="bg-red" box={16} dot={10} />
      <span class="whitespace-nowrap">{t("DISCONNECTED")}</span>
    </span>
  {:else if connecting || !ready}
    <span class={STATE_CLASS}>
      <LoadingIndicator size={16} />
      <span class="whitespace-nowrap">{connecting ? t("CONNECTING") : t("LOADING")}</span>
    </span>
  {:else}
    <PopupMenu open={openMenu === "model"} side="top" onOpenChange={(open) => (openMenu = open ? "model" : null)}>
      {#snippet trigger()}
        <TooltipWrap label={t("MODEL")}>
          <span class={ITEM_CLASS}>
            <Sparkles size={16} class="shrink-0 text-accent" />
            <span class="whitespace-nowrap">{modelLabel}</span>
          </span>
        </TooltipWrap>
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
        <TooltipWrap label={t("EFFORT")}>
          <span class={ITEM_CLASS}>
            <Gauge size={16} class="shrink-0 text-accent" />
            <span class="whitespace-nowrap">{effort}</span>
          </span>
        </TooltipWrap>
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
        <TooltipWrap label={t("PERMISSIONS")}>
          <span class={ITEM_CLASS}>
            <permission.icon size={16} class="shrink-0 {permission.tone}" />
            <span class="whitespace-nowrap">{permissionLabel}</span>
          </span>
        </TooltipWrap>
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
            <style.icon size={20} class="shrink-0 {style.tone}" />
          {/snippet}
        </MenuItem>
      {/each}
    </PopupMenu>

    {#if (capabilities?.accounts ?? []).length > 1}
      <PopupMenu
        open={openMenu === "account"}
        side="top"
        onOpenChange={(open) => (openMenu = open ? "account" : null)}
      >
        {#snippet trigger()}
          <TooltipWrap label={t("ACCOUNT")}>
            <span class={ITEM_CLASS}>
              <CircleUser size={16} class="shrink-0 text-accent" />
              <span class="whitespace-nowrap">{accountLabel}</span>
            </span>
          </TooltipWrap>
        {/snippet}
        {#each accountOptions as option (option.value)}
          <MenuItem
            text={option.label}
            selected={option.value === accountSelected}
            onclick={() => {
              onAccount(option.value);
              openMenu = null;
            }}
          />
        {/each}
      </PopupMenu>
    {/if}

    <TooltipWrap label={t("STREAMING")} class="flex h-full shrink-0 items-stretch">
      <button type="button" onclick={onStreamTokens} aria-label={t("STREAMING")} class={TOGGLE_CLASS}>
        <Radio size={16} class={streamTokens ? "text-green" : "text-on-surface-variant"} />
      </button>
    </TooltipWrap>
  {/if}
</div>

{#if !disconnected && !connecting && ready && contextTokens !== null && contextTokens > 0}
  <ContextRing tokens={contextTokens} limit={model.includes("1m") ? CONTEXT_LIMIT_LARGE : CONTEXT_LIMIT} />
{/if}
</div>
