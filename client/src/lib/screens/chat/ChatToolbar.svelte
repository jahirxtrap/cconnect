<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import Component from "@lucide/svelte/icons/component";
  import Gauge from "@lucide/svelte/icons/gauge";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Radio from "@lucide/svelte/icons/radio";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import type { PromptCache } from "$lib/data/promptCache";
  import type { LimitWindow } from "$lib/data/usageWindows";
  import { t } from "$lib/i18n/index.svelte";
  import { contextWindowFor, effortLevelsFor, type Capabilities } from "$lib/services/capabilitiesApi";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import { MENU_ICON_SIZE } from "$lib/ui/menuSurface";
  import { LINK_LOOKS } from "$lib/ui/linkStatus";
  import { hscrollbar, SCROLL_ROW_CLASS } from "$lib/ui/scrollbar";
  import ContextRing from "./ContextRing.svelte";
  import { permissionStyle } from "./permissionStyle";
  import { CHIP_ICON_SIZE, CHIP_SLOT } from "./toolbarChips";
  import ToolbarSelect from "./ToolbarSelect.svelte";
  import ToolbarState from "./ToolbarState.svelte";
  import ToolbarToggle from "./ToolbarToggle.svelte";
  import VisibilityToggle from "./VisibilityToggle.svelte";

  interface Props {
    capabilities: Capabilities | null;
    ready: boolean;
    connecting: boolean;
    switching: boolean;
    disconnected: boolean;
    loading: boolean;
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
    streamingSelected: string;
    simpleMode: boolean;
    contextTokens: number | null;
    cache: PromptCache | null;
    compactWindow: number | null;
    requestBytes: number | null;
    mediaBytes: number | null;
    limits: LimitWindow[];
    quickChatActive: boolean;
    onModel: (value: string) => void;
    onEffort: (value: string) => void;
    onPermissionMode: (value: string) => void;
    onStreamTokens: (value: string) => void;
    onVisibility: () => void;
    onQuickChat: () => void;
  }

  const {
    capabilities,
    ready,
    connecting,
    switching,
    disconnected,
    loading,
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
    streamingSelected,
    simpleMode,
    contextTokens,
    cache,
    compactWindow,
    requestBytes,
    mediaBytes,
    limits,
    quickChatActive,
    onModel,
    onEffort,
    onPermissionMode,
    onStreamTokens,
    onVisibility,
    onQuickChat,
  }: Props = $props();

  const serverOption = { value: "", label: t("SERVER_DEFAULT") };

  const modelOptions = $derived([
    serverOption,
    ...(capabilities?.models ?? []).map((item) => ({ value: item.id, label: item.label })),
  ]);
  const effortLevels = $derived(effortLevelsFor(capabilities, model));
  const effortOptions = $derived([
    serverOption,
    ...effortLevels.map((value) => ({ value, label: value })),
  ]);
  const permissionOptions = $derived([
    serverOption,
    ...(capabilities?.permissionModes ?? []).map((item) => ({ value: item.id, label: item.label })),
  ]);
  const streamingOptions = $derived([
    { value: "", label: t("SERVER_DEFAULT") },
    { value: "on", label: t("OPTION_ON") },
    { value: "off", label: t("OPTION_OFF") },
  ]);
  const accountOptions = $derived([
    serverOption,
    ...(capabilities?.accounts ?? [])
      .filter((item) => !item.provider)
      .map((item) => ({ value: item.id, label: item.label })),
  ]);
  const providerAccounts = $derived(
    (capabilities?.accounts ?? [])
      .filter((item) => item.provider)
      .map((item) => ({ value: item.id, label: item.label })),
  );
  const activeAccount = $derived(capabilities?.accounts?.find((item) => item.id === account));
  const accountLabel = $derived(activeAccount?.label ?? account);
  const AccountIcon = $derived(activeAccount?.provider ? Component : CircleUser);

  const modelsAvailable = $derived((capabilities?.models.length ?? 0) > 0);
  const modelLabel = $derived(capabilities?.models.find((item) => item.id === model)?.label ?? model);
  const modelWindow = $derived(contextWindowFor(capabilities, model));
  const contextWindow = $derived(
    modelWindow !== null && compactWindow !== null ? Math.min(modelWindow, compactWindow) : modelWindow,
  );
  const permissionLabel = $derived(
    capabilities?.permissionModes.find((item) => item.id === permissionMode)?.label ?? permissionMode,
  );
  const permission = $derived(permissionStyle(permissionMode));
  const serverPermission = $derived(capabilities?.defaults.permissionMode ?? "");
</script>

{#snippet choices(options: { value: string; label: string }[], selected: string, onPick: (value: string) => void)}
  {#each options as option (option.value)}
    <MenuItem text={option.label} selected={option.value === selected} onclick={() => onPick(option.value)} />
  {/each}
{/snippet}

<div class="flex h-full min-w-0 flex-1 items-stretch">
<ToolbarToggle label={t("QUICK_CHAT")} pressed={quickChatActive} class="{CHIP_SLOT} pr-1.5 pl-0.5" onclick={onQuickChat}>
  <MessagesSquare size={CHIP_ICON_SIZE} class="text-accent" />
</ToolbarToggle>

<div
  use:hscrollbar={{ wheel: true }}
  class="{SCROLL_ROW_CLASS} flex min-w-0 flex-1 items-center gap-1.5"
>
  {#if disconnected}
    <ToolbarState text={t(LINK_LOOKS.disconnected.text)} dot={LINK_LOOKS.disconnected.dot} />
  {:else if connecting || !ready}
    <ToolbarState text={connecting ? t(LINK_LOOKS.connecting.text) : t("LOADING")} loading />
  {:else}
    {#if switching}
      <ToolbarState text={t("LOADING")} loading />
    {:else if !modelsAvailable}
      <ToolbarState text={t("MODEL_UNAVAILABLE")} icon={Sparkles} />
    {:else}
      <ToolbarSelect label={t("MODEL")} icon={Sparkles} text={modelLabel}>
        {@render choices(modelOptions, modelSelected, onModel)}
      </ToolbarSelect>
    {/if}

    {#if effortLevels.length && !switching}
      <ToolbarSelect label={t("EFFORT")} icon={Gauge} text={effort}>
        {@render choices(effortOptions, effortSelected, onEffort)}
      </ToolbarSelect>
    {/if}

    <ToolbarSelect label={t("PERMISSIONS")} icon={permission.icon} iconClass={permission.tone} text={permissionLabel}>
      {#each permissionOptions as option (option.value)}
        {@const style = permissionStyle(option.value || serverPermission)}
        <MenuItem
          text={option.label}
          selected={option.value === permissionSelected}
          onclick={() => onPermissionMode(option.value)}
        >
          {#snippet leading()}
            <style.icon size={MENU_ICON_SIZE} class="shrink-0 {style.tone}" />
          {/snippet}
        </MenuItem>
      {/each}
    </ToolbarSelect>

    {#if (capabilities?.accounts ?? []).length > 1}
      <ToolbarSelect label={t("ACCOUNT")} icon={AccountIcon} text={accountLabel}>
        {@render choices(accountOptions, accountSelected, onAccount)}
        {#if providerAccounts.length}
          <div class="my-1 border-t border-outline-variant"></div>
          {@render choices(providerAccounts, accountSelected, onAccount)}
        {/if}
      </ToolbarSelect>
    {/if}

    <ToolbarSelect
      label={t("STREAMING")}
      icon={Radio}
      iconClass={streamTokens ? "text-green" : "text-on-surface-variant"}
    >
      {@render choices(streamingOptions, streamingSelected, onStreamTokens)}
    </ToolbarSelect>

    <VisibilityToggle {simpleMode} {onVisibility} />
  {/if}
</div>

{#if !disconnected && !connecting && !loading && ready && contextWindow !== null}
  <ContextRing
    tokens={contextTokens ?? 0}
    limit={contextWindow}
    {cache}
    bytes={mediaBytes}
    totalBytes={requestBytes}
    byteLimit={capabilities?.requestLimit ?? null}
    {limits}
  />
{/if}
</div>
