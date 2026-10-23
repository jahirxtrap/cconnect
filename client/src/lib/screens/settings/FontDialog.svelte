<script lang="ts">
  import { FONT_FAMILIES, FONT_KINDS } from "$lib/design/fonts";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import { fontOptions } from "./settingsValues";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  let page = $state(0);

  const kind = $derived(FONT_KINDS[page]);
  const labels = $derived(FONT_KINDS.map((each) => t(`FONT_${each.toUpperCase()}`)));
</script>

<CompactDialog title={t("FONT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  {#snippet header()}
    <SegmentedButtons options={labels} selected={page} onSelect={(index) => (page = index)} />
  {/snippet}
  {#each fontOptions[kind]() as option (option.value)}
    {@const props = {
      label: option.label,
      labelFont: option.font,
      selected: theme.fonts[kind] === option.value,
      onclick: () => theme.setFont(kind, option.value),
    }}
    {#if kind === "emoji"}
      <DialogSelectItem {...props}>
        {#snippet trailing()}
          <span class="flex h-7 w-9 items-center justify-center text-[22px]" style="font-family: {FONT_FAMILIES.emoji[option.value]}"
            >😃</span
          >
        {/snippet}
      </DialogSelectItem>
    {:else}
      <DialogSelectItem {...props} />
    {/if}
  {/each}
</CompactDialog>
