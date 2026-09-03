<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Type from "@lucide/svelte/icons/type";
  import { t } from "$lib/i18n/index.svelte";
  import { paneActionClass } from "$lib/screens/chat/paneChrome";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import { saveTextAs, saveTextToDownloads, shareText } from "$lib/services/sharedFiles";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { scratch } from "./scratch.svelte";

  let menu = $state(false);

  const filename = $derived(t("MARKDOWN_FILENAME"));
  const actionClass = paneActionClass(inPane());
</script>

<TooltipIconButton
  label={t("FORMATTED_VIEW")}
  class={actionClass}
  onclick={() => (scratch.formatted = !scratch.formatted)}
>
  <Type class={scratch.formatted ? "text-accent" : ""} />
</TooltipIconButton>
<PopupMenu
  open={menu}
  onOpenChange={(open) => (menu = open)}
  label={t("MORE_OPTIONS")}
  align="center"
>
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("MORE_OPTIONS")} class={actionClass} {...props}>
      <EllipsisVertical />
    </TooltipIconButton>
  {/snippet}
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
</PopupMenu>
