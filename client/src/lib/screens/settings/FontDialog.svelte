<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import { DEFAULT_FONTS, FONT_FAMILIES, FONT_KINDS, type FontKind } from "$lib/design/fonts";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import SelectDialog, { type SelectOption } from "$lib/ui/SelectDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { fontOptions } from "./settingsValues";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const PREVIEWS: Record<FontKind, string> = { text: "Aa", code: "Aa", symbols: "✓✂⏎", emoji: "😃" };
  const SAMPLED: ReadonlySet<FontKind> = new Set(["symbols", "emoji"]);

  let draft = $state<Record<FontKind, string>>({ ...theme.fonts });
  let picking = $state<FontKind | null>(null);

  const titleOf = (kind: FontKind) => t(`FONT_${kind.toUpperCase()}`);
  const nameOf = (kind: FontKind) =>
    fontOptions[kind]().find((option) => option.value === draft[kind])?.label ?? draft[kind];
  const customized = $derived(FONT_KINDS.some((kind) => draft[kind] !== DEFAULT_FONTS[kind]));

  const save = () => {
    for (const kind of FONT_KINDS) theme.setFont(kind, draft[kind]);
    onDismiss();
  };
</script>

<CompactDialog title={t("FONT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={() => (draft = { ...DEFAULT_FONTS })} enabled={customized} variant="outlined">
      {t("RESET")}
    </Button>
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save}>{t("SAVE")}</Button>
  {/snippet}
  {#each FONT_KINDS as kind (kind)}
    <ListRow
      class="rounded-lg"
      padding="py-2.5 pr-1 pl-3"
      title={titleOf(kind)}
      subtitle={nameOf(kind)}
      onclick={() => (picking = kind)}
    >
      {#snippet trailing()}
        {@render preview(kind, draft[kind])}
        <TooltipIconButton
          label={t("RESET")}
          enabled={draft[kind] !== DEFAULT_FONTS[kind]}
          class="[&_svg]:size-5"
          onclick={() => (draft[kind] = DEFAULT_FONTS[kind])}
        >
          <RotateCcw />
        </TooltipIconButton>
      {/snippet}
    </ListRow>
  {/each}
</CompactDialog>

{#snippet preview(kind: FontKind, value: string)}
  <span class="flex h-7 min-w-9 items-center justify-center px-1 text-body-lg" style="font-family: {FONT_FAMILIES[kind][value]}"
    >{PREVIEWS[kind]}</span
  >
{/snippet}

{#if picking}
  {@const kind = picking}
  {#snippet sample(option: SelectOption)}
    {@render preview(kind, option.value)}
  {/snippet}
  <SelectDialog
    title={titleOf(kind)}
    options={fontOptions[kind]()}
    selected={draft[kind]}
    onSelect={(value) => (draft[kind] = value)}
    onDismiss={() => (picking = null)}
    optionTrailing={SAMPLED.has(kind) ? sample : undefined}
  />
{/if}
