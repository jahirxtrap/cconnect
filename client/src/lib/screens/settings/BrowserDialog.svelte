<script lang="ts">
  import Trash from "@lucide/svelte/icons/trash";
  import { untrack } from "svelte";
  import { formatSize } from "$lib/data/format";
  import { settings } from "$lib/data/settings.svelte";
  import { formatDayTime } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { systemName } from "$lib/platform";
  import BrowserClearDialog from "$lib/screens/browser/BrowserClearDialog.svelte";
  import { deviceBrowser } from "$lib/screens/browser/deviceBrowser.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const LISTS = [
    { id: "easylist", label: "BROWSER_LIST_EASYLIST", summary: "BROWSER_LIST_EASYLIST_SUMMARY" },
    { id: "easyprivacy", label: "BROWSER_LIST_EASYPRIVACY", summary: "BROWSER_LIST_EASYPRIVACY_SUMMARY" },
    { id: "ublock", label: "BROWSER_LIST_UBLOCK", summary: "BROWSER_LIST_UBLOCK_SUMMARY" },
    { id: "annoyances", label: "BROWSER_LIST_ANNOYANCES", summary: "BROWSER_LIST_ANNOYANCES_SUMMARY" },
    { id: "cookies", label: "BROWSER_LIST_COOKIES", summary: "BROWSER_LIST_COOKIES_SUMMARY" },
  ];
  const PROXY_MODES = [
    { value: "system", label: t("BROWSER_PROXY_SYSTEM") },
    ...(systemName() === "macos" ? [] : [{ value: "none", label: t("BROWSER_PROXY_NONE") }]),
    { value: "manual", label: t("BROWSER_PROXY_MANUAL") },
  ];

  let shield = $state(untrack(() => ({ ...settings.browserShield })));
  let proxy = $state(untrack(() => ({ ...settings.browserProxy })));
  let updating = $state(false);
  let failed = $state(false);
  let size = $state<number | null>(null);
  let clearing = $state(false);

  const sameItems = (left: string[], right: string[]) =>
    left.length === right.length && left.every((item) => right.includes(item));

  const shieldChanged = $derived(
    shield.enabled !== settings.browserShield.enabled ||
      !sameItems(shield.lists, settings.browserShield.lists) ||
      !sameItems(shield.allowed, settings.browserShield.allowed),
  );
  const proxyChanged = $derived(
    proxy.mode !== settings.browserProxy.mode ||
      proxy.url.trim() !== settings.browserProxy.url ||
      proxy.bypass.trim() !== settings.browserProxy.bypass,
  );
  const ready = $derived((shieldChanged || proxyChanged) && (proxy.mode !== "manual" || !!proxy.url.trim()));

  const measure = async () => (size = await deviceBrowser.dataSize());

  const toggleList = (id: string, on: boolean) => {
    const others = shield.lists.filter((item) => item !== id);
    shield = { ...shield, lists: on ? [...others, id] : others };
  };

  const update = async () => {
    updating = true;
    failed = false;
    try {
      await deviceBrowser.refreshLists();
    } catch {
      failed = true;
    }
    updating = false;
  };

  const save = () => {
    if (shieldChanged) {
      settings.browserShield = { ...shield };
      void deviceBrowser.guard();
    }
    if (proxyChanged) {
      settings.browserProxy = { mode: proxy.mode, url: proxy.url.trim(), bypass: proxy.bypass.trim() };
      void deviceBrowser.restart();
    }
    onDismiss();
  };

  $effect(() => {
    void measure();
  });
</script>

<CompactDialog title={t("BROWSER")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button enabled={ready} onclick={save}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex flex-col gap-3.5">
    <div>
      <SwitchRow
        title={t("BROWSER_SHIELD")}
        summary={t("BROWSER_SHIELD_SUMMARY")}
        checked={shield.enabled}
        onChange={(value) => (shield = { ...shield, enabled: value })}
      />
      {#if shield.enabled}
        {#each LISTS as list (list.id)}
          <SwitchRow
            title={t(list.label)}
            summary={t(list.summary)}
            checked={shield.lists.includes(list.id)}
            onChange={(value) => toggleList(list.id, value)}
          />
        {/each}
      {/if}
    </div>
    {#if shield.enabled}
      <div>
        <p class="text-body-sm text-on-surface-variant">
          {failed
            ? t("BROWSER_SHIELD_FAILED")
            : deviceBrowser.shield.updated
              ? t("BROWSER_SHIELD_UPDATED", formatDayTime(deviceBrowser.shield.updated * 1000))
              : t("BROWSER_SHIELD_PENDING")}
        </p>
        <ActionButton
          class="mt-2.5 w-full"
          text={t("BROWSER_SHIELD_UPDATE")}
          enabled={!updating && settings.browserShield.lists.length > 0}
          onclick={() => void update()}
        />
      </div>
      {#if shield.allowed.length}
        <div>
          <p class="mb-2 text-body-sm text-on-surface-variant">{t("BROWSER_SHIELD_ALLOWED")}</p>
          {#each shield.allowed as host (host)}
            <div class="flex items-center rounded-item pr-1 transition-colors hover:bg-on-surface/8">
              <p class="min-w-0 flex-1 truncate px-3 py-2.5 text-body-md">{host}</p>
              <TooltipIconButton
                label={t("DELETE")}
                class="[&_svg]:size-[18px]"
                onclick={() => (shield = { ...shield, allowed: shield.allowed.filter((item) => item !== host) })}
              >
                <Trash />
              </TooltipIconButton>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
    <SelectField
      label={t("BROWSER_PROXY")}
      selected={proxy.mode}
      options={PROXY_MODES}
      onSelect={(value) => (proxy = { ...proxy, mode: value })}
    />
    {#if proxy.mode === "manual"}
      <InputField
        value={proxy.url}
        oninput={(value) => (proxy = { ...proxy, url: value })}
        label={t("BROWSER_PROXY_URL")}
        placeholder={t("BROWSER_PROXY_URL_HINT")}
        singleLine
      />
      <InputField
        value={proxy.bypass}
        oninput={(value) => (proxy = { ...proxy, bypass: value })}
        label={t("BROWSER_PROXY_BYPASS")}
        placeholder={t("BROWSER_PROXY_BYPASS_HINT")}
        singleLine
      />
    {/if}
    <div>
      <p class="text-body-md">{t("BROWSER_DATA")}</p>
      {#if size !== null}
        <p class="text-body-sm text-on-surface-variant">{t("BROWSER_DATA_SIZE", formatSize(size))}</p>
      {/if}
      <ActionButton class="mt-2.5 w-full" text={t("BROWSER_DATA_CLEAR")} onclick={() => (clearing = true)} />
    </div>
  </div>
</CompactDialog>

{#if clearing}
  <BrowserClearDialog onDismiss={() => (clearing = false)} onCleared={() => void measure()} />
{/if}
