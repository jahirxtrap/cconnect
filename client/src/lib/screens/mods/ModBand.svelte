<script lang="ts">
  import { slide } from "svelte/transition";
  import { joined } from "$lib/data/format";
  import { settings } from "$lib/data/settings.svelte";
  import { isEmptyTree, type ModNode } from "$lib/data/modModels";
  import { paneFocus } from "$lib/data/paneFocus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import { keepTyping, typingOnTouch } from "$lib/ui/keepFocus";
  import PanelHandle from "$lib/ui/PanelHandle.svelte";
  import ModInline from "./ModInline.svelte";
  import ModSite from "./ModSite.svelte";
  import { BAND_ID, band, type ModSurface } from "./modSurface.svelte";

  interface Props {
    mods: ModSurface;
    draft: boolean;
    working: boolean;
    hidden?: boolean;
    instant?: boolean;
    active?: boolean;
  }

  const { mods, draft, working, hidden = false, instant = false, active = true }: Props = $props();

  let card = $state<HTMLElement | null>(null);
  let focused = $state(false);

  const focusBand = (): boolean => {
    const site = card?.querySelector<HTMLElement>("[data-mod-site]");
    if (!site || band.hidden || !drawnBand) return false;
    site.focus();
    return true;
  };

  const focusFromCard = (event: MouseEvent) => {
    if (typingOnTouch() || (event.target as HTMLElement).closest("button, a, input, textarea, [data-mod-site]")) return;
    focusBand();
  };

  useShortcut("mods.band.focus", focusBand, () => active);

  useShortcut(
    "mods.band.toggle",
    () => {
      if (!present || hidden) return false;
      band.toggle();
      return true;
    },
    () => active,
  );

  const BAND_ROWS = 8;
  const CARD_INSET = "0.875rem";
  const TOGGLE_MS = 200;
  const HINT_ID = "prompt-hint";
  const MODE_ID = "session-mode";
  const MODE_JOIN = " & ";

  const hintProps = $derived({ isDraft: draft, isWorking: working, hint: "" });
  const modeProps = { modes: [] };

  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== "") : [];

  const text = (value: unknown): string => (typeof value === "string" ? value : "");

  const shows = (tree: ModNode | null | undefined): boolean => !!tree && !isEmptyTree(tree);

  const drawnBand = $derived(shows(mods.tree("AbovePrompt", BAND_ID)));
  const hint = $derived(mods.drawing("PromptHint", HINT_ID));
  const mode = $derived(mods.drawing("SessionMode", MODE_ID));
  const status = $derived(mods.state.status);
  const hintShown = $derived(shows(hint?.tree) || !!text(hint?.props?.hint) || !!text(hint?.props?.tail));
  const modeShown = $derived(shows(mode?.tree) || strings(mode?.props?.modes).length > 0);
  const footer = $derived(status.length > 0 || hintShown || modeShown);
  const answered = $derived(!mods.state.surface || mods.drawn("AbovePrompt", BAND_ID));
  const drawn = $derived(answered && (drawnBand || footer));
  const shown = $derived(!hidden && (settings.modBandHandle || !band.hidden));
  const present = $derived(mods.state.surface || status.length > 0);
  const duration = $derived(instant ? 0 : TOGGLE_MS);
</script>

{#snippet hintLine(props: Record<string, unknown>)}
  {#if text(props.hint) || text(props.tail)}
    <span class="block truncate">{joined(text(props.hint), text(props.tail))}</span>
  {/if}
{/snippet}

{#snippet modeLine(props: Record<string, unknown>)}
  {#if strings(props.modes).length}
    <span class="block truncate">{strings(props.modes).join(MODE_JOIN)}</span>
  {/if}
{/snippet}

{#snippet site()}
  {#if mods.state.surface}
    <ModSite
      {mods}
      component="AbovePrompt"
      instanceId={BAND_ID}
      rows={BAND_ROWS}
      flush
      thin
      fit
      edge={CARD_INSET}
      bodyClass="pl-3.5"
      scrollClass="rounded-viewport [--viewport-radius:var(--radius-md)] [--viewport-radius-end:0px]"
      onFocusChange={(held) => (focused = held)}
      onEscape={() => paneFocus.focusActive()}
    />
  {/if}
{/snippet}

{#snippet footerRow()}
  <div
    class="flex min-w-0 items-center gap-3 px-3.5 text-body-sm text-on-surface-variant {drawnBand && footer
      ? 'pt-1.5'
      : ''} {footer ? '' : 'h-0 overflow-hidden'}"
  >
    <div class="min-w-0 flex-1">
      {#if mods.state.surface}
        <ModInline {mods} component="PromptHint" instanceId={HINT_ID} props={hintProps} engine={hintLine} eager />
      {/if}
    </div>
    <div class="flex min-w-0 shrink items-center">
      <div class="flex min-w-0 items-center gap-3">
        {#each status as entry (entry.plugin)}
          <span class="flex min-w-0 items-baseline gap-1.5">
            {#if entry.plugin}
              <span class="shrink-0 font-mono text-caption text-accent">{entry.plugin}</span>
            {/if}
            <span class="truncate text-on-surface">{entry.text}</span>
          </span>
        {/each}
      </div>
      {#if mods.state.surface}
        <ModInline
          {mods}
          component="SessionMode"
          instanceId={MODE_ID}
          props={modeProps}
          engine={modeLine}
          eager
          class={modeShown && status.length ? "ml-3" : ""}
        />
      {/if}
    </div>
  </div>
{/snippet}

<div>
  {#if present}
    {#if shown}
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <div
        bind:this={card}
        onclick={focusFromCard}
        onpointerdown={keepTyping}
        transition:slide={{ duration }}
        class={drawn
          ? `relative -mb-[var(--radius-dock)] rounded-t-dock bg-surface-variant pb-[calc(var(--radius-dock)+0.5rem)] ${settings.modBandHandle ? "" : "pt-2"}`
          : "h-0 overflow-hidden"}
      >
        {#if settings.modBandHandle}
          <button
            type="button"
            aria-label={band.hidden ? t("MOD_BAND_SHOW") : t("MOD_BAND_HIDE")}
            title={band.hidden ? t("MOD_BAND_SHOW") : t("MOD_BAND_HIDE")}
            onclick={() => band.toggle()}
            class="flex w-full cursor-pointer justify-center pt-1.5 pb-1"
          >
            <PanelHandle active={focused} />
          </button>
        {/if}
        {#if band.hidden}
          <div class="h-0 overflow-hidden">{@render site()}{@render footerRow()}</div>
        {:else}
          <div transition:slide={{ duration }}>{@render site()}{@render footerRow()}</div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
