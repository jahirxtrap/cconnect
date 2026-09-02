<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Type from "@lucide/svelte/icons/type";
  import { DropdownMenu } from "bits-ui";
  import { t } from "$lib/i18n/index.svelte";
  import { saveTextAs, saveTextToDownloads, shareText } from "$lib/services/sharedFiles";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuScrim from "$lib/ui/MenuScrim.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { MENU_CONTENT_CLASS } from "$lib/ui/menuSurface";
  import { scratch } from "./scratch.svelte";

  interface Props {
    compact?: boolean;
  }

  const { compact = false }: Props = $props();

  let menu = $state(false);

  const filename = $derived(t("MARKDOWN_FILENAME"));
  const buttonClass = $derived(compact ? "size-8" : "");
  const iconSize = $derived(compact ? 18 : 20);
</script>

<TooltipIconButton
  label={t("FORMATTED_VIEW")}
  class={buttonClass}
  onclick={() => (scratch.formatted = !scratch.formatted)}
>
  <Type size={iconSize} class={scratch.formatted ? "text-accent" : ""} />
</TooltipIconButton>
<MenuScrim open={menu} onDismiss={() => (menu = false)} />
<DropdownMenu.Root open={menu} onOpenChange={(open) => (menu = open)}>
  <DropdownMenu.Trigger
    class="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8 {compact
      ? 'size-8'
      : 'size-9'}"
    aria-label={t("FILES")}
  >
    <EllipsisVertical size={iconSize} />
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      sideOffset={4}
      class={MENU_CONTENT_CLASS}
    >
      <MenuItem text={t("SAVE")} onclick={() => saveTextToDownloads(filename, scratch.text)}>
        {#snippet leading()}
          <Download size={20} class="shrink-0 text-on-surface-variant" />
        {/snippet}
      </MenuItem>
      <MenuItem text={t("SAVE_AS")} onclick={() => void saveTextAs(filename, scratch.text)}>
        {#snippet leading()}
          <Save size={20} class="shrink-0 text-on-surface-variant" />
        {/snippet}
      </MenuItem>
      <MenuItem text={t("SHARE")} onclick={() => void shareText(filename, scratch.text)}>
        {#snippet leading()}
          <Share2 size={20} class="shrink-0 text-on-surface-variant" />
        {/snippet}
      </MenuItem>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
