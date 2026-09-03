<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import DialogSelectItem from "./DialogSelectItem.svelte";
  import EmptyState from "./EmptyState.svelte";

  export interface SelectOption {
    value: string;
    label: string;
    subtitle?: string | null;
    font?: string | null;
  }

  interface Props {
    title: string;
    options: SelectOption[];
    selected: string;
    onDismiss: () => void;
    onSelect?: (value: string) => void;
    onConfirm?: (value: string) => void;
    optionTrailing?: Snippet<[SelectOption]>;
    empty?: string;
  }

  const { title, options, selected, onDismiss, onSelect, onConfirm, optionTrailing, empty }: Props =
    $props();

  let choice = $state(untrack(() => selected));
</script>

<CompactDialog {title} {onDismiss} padded={false}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    {#if onConfirm}
      <Button onclick={() => onConfirm(choice)}>{t("SAVE")}</Button>
    {/if}
  {/snippet}
  {#each options as option (option.value)}
    {@const props = {
      label: option.label,
      subtitle: option.subtitle,
      labelFont: option.font,
      selected: option.value === (onConfirm ? choice : selected),
      onclick: () => {
        choice = option.value;
        if (!onConfirm) {
          onSelect?.(option.value);
          onDismiss();
        }
      },
    }}
    {#if optionTrailing}
      <DialogSelectItem {...props}>
        {#snippet trailing()}
          {@render optionTrailing(option)}
        {/snippet}
      </DialogSelectItem>
    {:else}
      <DialogSelectItem {...props} />
    {/if}
  {:else}
    <EmptyState text={empty ?? t("NO_RESULTS")} class="py-8" />
  {/each}
</CompactDialog>
