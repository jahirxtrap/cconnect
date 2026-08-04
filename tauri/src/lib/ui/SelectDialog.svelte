<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import DialogSelectItem from "./DialogSelectItem.svelte";

  export interface SelectOption {
    value: string;
    label: string;
    subtitle?: string | null;
  }

  interface Props {
    title: string;
    options: SelectOption[];
    selected: string;
    onDismiss: () => void;
    onSelect?: (value: string) => void;
    onConfirm?: (value: string) => void;
  }

  const { title, options, selected, onDismiss, onSelect, onConfirm }: Props = $props();

  let choice = $state(untrack(() => selected));
</script>

<CompactDialog {title} {onDismiss} padded={false}>
  {#snippet buttons()}
    <Button onclick={onDismiss}>{t("CANCEL")}</Button>
    {#if onConfirm}
      <Button onclick={() => onConfirm(choice)}>{t("SAVE")}</Button>
    {/if}
  {/snippet}
  {#each options as option (option.value)}
    <DialogSelectItem
      label={option.label}
      subtitle={option.subtitle}
      selected={option.value === (onConfirm ? choice : selected)}
      onclick={() => {
        choice = option.value;
        if (!onConfirm) {
          onSelect?.(option.value);
          onDismiss();
        }
      }}
    />
  {/each}
</CompactDialog>
