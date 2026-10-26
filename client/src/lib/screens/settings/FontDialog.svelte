<script lang="ts">
  import { DEFAULT_FONTS, FONT_SAMPLES, SAMPLED_FONT_KINDS } from "$lib/design/fonts";
  import { loadFace } from "$lib/design/packs/faces";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { FONT_KINDS, type FontKind } from "$lib/design/packs/schema";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog, { DIALOG_PAGE_CLASS } from "$lib/ui/CompactDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import TabPager, { TAB_PAGE_CLASS } from "$lib/ui/TabPager.svelte";
  import { fontLabel, packLabel } from "./settingsValues";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  let draft = $state(
    Object.fromEntries(FONT_KINDS.map((kind) => [kind, packs.fontOf(kind, theme.fonts[kind]).id])) as Record<FontKind, string>,
  );
  let kind = $state<FontKind>(FONT_KINDS[0]);

  $effect(() => {
    for (const value of FONT_KINDS) for (const font of packs.fontsOf(value)) void loadFace(font);
  });

  const titleOf = (value: FontKind) => t(`FONT_${value.toUpperCase()}`);
  const customized = $derived(FONT_KINDS.some((value) => draft[value] !== DEFAULT_FONTS[value]));

  const save = () => {
    for (const value of FONT_KINDS) theme.setFont(value, draft[value]);
    onDismiss();
  };
</script>

<CompactDialog title={t("FONT")} {onDismiss} paged>
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
  <TabPager selected={FONT_KINDS.indexOf(kind)} onSelect={(index) => (kind = FONT_KINDS[index])} class="min-h-0">
    {#each FONT_KINDS as value (value)}
      <div use:viewportScrollbar class="{TAB_PAGE_CLASS} {DIALOG_PAGE_CLASS}">
        {#each [packs.systemFont(value), ...packs.fontsOf(value)] as font (font.id)}
          <DialogSelectItem
            label={fontLabel(font)}
            subtitle={packLabel(font.pack)}
            labelFont={SAMPLED_FONT_KINDS.has(value) ? null : font.family}
            selected={draft[value] === font.id}
            onclick={() => (draft[value] = font.id)}
          >
            {#snippet trailing()}
              {#if SAMPLED_FONT_KINDS.has(value)}
                <span
                  class="flex h-7 min-w-9 items-center justify-center px-1 text-body-lg"
                  style="font-family: {font.family}">{FONT_SAMPLES[value]}</span
                >
              {/if}
            {/snippet}
          </DialogSelectItem>
        {/each}
      </div>
    {/each}
  </TabPager>
</CompactDialog>
