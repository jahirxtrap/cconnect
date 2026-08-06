<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Type from "@lucide/svelte/icons/type";
  import { DropdownMenu } from "bits-ui";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { store } from "$lib/platform/storage";
  import { saveTextAs, saveTextToDownloads, shareText } from "$lib/services/sharedFiles";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuScrim from "$lib/ui/MenuScrim.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  const SCRATCH_KEY = "markdown.scratch";
  const SAVE_DELAY_MS = 400;

  let text = $state(store.get(SCRATCH_KEY, ""));
  let formatted = $state(false);
  let menu = $state(false);

  const filename = $derived(t("MARKDOWN_FILENAME"));

  $effect(() => {
    const value = text;
    const timer = setTimeout(() => store.set(SCRATCH_KEY, value), SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      store.set(SCRATCH_KEY, value);
    };
  });
</script>

<div class="flex h-full flex-col">
  <AppTopBar title={t("MARKDOWN")}>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
    {#snippet actions()}
      <TooltipIconButton label={t("FORMATTED_VIEW")} onclick={() => (formatted = !formatted)}>
        <Type size={20} class={formatted ? "text-accent" : ""} />
      </TooltipIconButton>
      <MenuScrim open={menu} onDismiss={() => (menu = false)} />
      <DropdownMenu.Root open={menu} onOpenChange={(open) => (menu = open)}>
        <DropdownMenu.Trigger
          class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8 [&_svg]:size-5"
          aria-label={t("FILES")}
        >
          <EllipsisVertical size={20} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            class="menu-surface z-50 min-w-44 rounded-md border border-outline-variant bg-surface-variant p-1 shadow-lg"
          >
            <MenuItem text={t("SAVE")} onclick={() => saveTextToDownloads(filename, text)}>
              {#snippet leading()}
                <Download size={16} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            <MenuItem text={t("SAVE_AS")} onclick={() => void saveTextAs(filename, text)}>
              {#snippet leading()}
                <Save size={16} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            <MenuItem text={t("SHARE")} onclick={() => void shareText(filename, text)}>
              {#snippet leading()}
                <Share2 size={16} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    {/snippet}
  </AppTopBar>

  {#if formatted}
    <div class="selectable min-h-0 flex-1 overflow-y-auto p-4">
      <MarkdownText {text} />
    </div>
  {:else}
    <textarea
      bind:value={text}
      spellcheck="false"
      class="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-body-md caret-accent outline-none"
    ></textarea>
  {/if}
</div>
