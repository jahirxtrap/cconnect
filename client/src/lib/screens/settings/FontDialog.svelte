<script lang="ts">
  import { DEFAULT_FONTS, FONT_FAMILIES, FONT_KINDS, type FontKind } from "$lib/design/fonts";
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

  const PREVIEWS: Record<FontKind, string> = { text: "Aa", code: "Aa", symbols: "✓✂⏎", emoji: "😃" };
  const SAMPLED: ReadonlySet<FontKind> = new Set(["symbols", "emoji"]);

  let draft = $state<Record<FontKind, string>>({ ...theme.fonts });
  let kind = $state<FontKind>(FONT_KINDS[0]);

  const titleOf = (value: FontKind) => t(`FONT_${value.toUpperCase()}`);
  const customized = $derived(FONT_KINDS.some((value) => draft[value] !== DEFAULT_FONTS[value]));

  const save = () => {
    for (const value of FONT_KINDS) theme.setFont(value, draft[value]);
    onDismiss();
  };
</script>

<CompactDialog title={t("FONT")} {onDismiss}>
  {#snippet header()}
    <SegmentedButtons
      options={FONT_KINDS.map(titleOf)}
      selected={FONT_KINDS.indexOf(kind)}
      onSelect={(index) => (kind = FONT_KINDS[index])}
      fill
    />
  {/snippet}
  {#snippet buttons()}
    <Button onclick={() => (draft = { ...DEFAULT_FONTS })} enabled={customized} variant="outlined">
      {t("RESET")}
    </Button>
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save}>{t("SAVE")}</Button>
  {/snippet}
  {#each fontOptions[kind]() as option (`${kind}:${option.value}`)}
    <DialogSelectItem
      label={option.label}
      labelFont={option.font}
      selected={draft[kind] === option.value}
      onclick={() => (draft[kind] = option.value)}
    >
      {#snippet trailing()}
        {#if SAMPLED.has(kind)}
          <span
            class="flex h-7 min-w-9 items-center justify-center px-1 text-body-lg"
            style="font-family: {FONT_FAMILIES[kind][option.value]}">{PREVIEWS[kind]}</span
          >
        {/if}
      {/snippet}
    </DialogSelectItem>
  {/each}
</CompactDialog>
