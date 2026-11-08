<script lang="ts">
  import { untrack } from "svelte";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { THEME_KINDS, type ThemeKind } from "$lib/design/packs/schema";
  import { theme } from "$lib/design/theme.svelte";
  import { DEFAULT_TERMINAL, DEFAULT_THEMES } from "$lib/design/themes";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog, { DIALOG_PAGE_CLASS } from "$lib/ui/CompactDialog.svelte";
  import DialogSelectItem from "$lib/ui/DialogSelectItem.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import SwatchRow from "$lib/ui/SwatchRow.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import TabPager, { TAB_PAGE_CLASS } from "$lib/ui/TabPager.svelte";
  import { packLabel, terminalSwatches, themeSwatches, themeTabLabel, type ThemeTab } from "./settingsValues";

  interface Props {
    tabs: readonly ThemeTab[];
    onDismiss: () => void;
  }

  const { tabs, onDismiss }: Props = $props();

  let themes = $state(
    Object.fromEntries(THEME_KINDS.map((kind) => [kind, packs.themeOf(kind, theme.themeIds[kind]).id])) as Record<
      ThemeKind,
      string
    >,
  );
  let terminal = $state(packs.terminalOf(theme.terminalId).id);
  let tab = $state<ThemeTab>(untrack(() => tabs[0]));

  $effect(() => {
    const shown = tab === "terminal" ? theme.modeKind : tab;
    theme.preview = { kind: shown, theme: themes[shown], terminal };
  });

  $effect(() => () => {
    theme.preview = null;
  });

  const optionsOf = (value: ThemeTab) =>
    value === "terminal"
      ? packs.terminals.map((item) => ({ ...item, swatches: terminalSwatches(item) }))
      : packs.themesOf(value).map((item) => ({ ...item, swatches: themeSwatches(item) }));
  const selectedOf = (value: ThemeTab) => (value === "terminal" ? terminal : themes[value]);
  const customized = $derived(
    tabs.some((value) => (value === "terminal" ? terminal !== DEFAULT_TERMINAL : themes[value] !== DEFAULT_THEMES[value])),
  );

  const choose = (value: ThemeTab, id: string) => {
    if (value === "terminal") terminal = id;
    else themes[value] = id;
  };

  const reset = () => {
    for (const value of tabs) {
      if (value === "terminal") terminal = DEFAULT_TERMINAL;
      else themes[value] = DEFAULT_THEMES[value];
    }
  };

  const save = () => {
    for (const value of tabs) {
      if (value === "terminal") theme.setTerminal(terminal);
      else theme.setTheme(value, themes[value]);
    }
    onDismiss();
  };
</script>

<CompactDialog title={t("THEME")} {onDismiss} paged>
  {#snippet header()}
    <SegmentedButtons
      options={tabs.map(themeTabLabel)}
      selected={tabs.indexOf(tab)}
      onSelect={(index) => (tab = tabs[index])}
      fill
    />
  {/snippet}
  {#snippet buttons()}
    <Button onclick={reset} enabled={customized} variant="outlined">{t("RESET")}</Button>
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save}>{t("SAVE")}</Button>
  {/snippet}
  <TabPager selected={tabs.indexOf(tab)} onSelect={(index) => (tab = tabs[index])} class="min-h-0">
    {#each tabs as value (value)}
      <div use:viewportScrollbar class="{TAB_PAGE_CLASS} {DIALOG_PAGE_CLASS}">
        {#each optionsOf(value) as option (option.id)}
          <DialogSelectItem
            label={option.name}
            subtitle={packLabel(option.pack)}
            selected={selectedOf(value) === option.id}
            onclick={() => choose(value, option.id)}
          >
            {#snippet trailing()}
              <span class="px-2"><SwatchRow colors={option.swatches} /></span>
            {/snippet}
          </DialogSelectItem>
        {/each}
      </div>
    {/each}
  </TabPager>
</CompactDialog>
