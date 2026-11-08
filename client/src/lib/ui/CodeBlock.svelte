<script lang="ts" module>
  export const CAPPED_HEIGHT = "max-h-72";
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import { theme } from "$lib/design/theme.svelte";
  import { highlight, resolveLang } from "$lib/markdown/highlighter";
  import { CopyFeedback } from "./copyFeedback.svelte";
  import { hscrollbar, TEXT_VIEWPORT_CLASS, viewportScrollbar } from "./scrollbar";

  interface Props {
    code: string;
    lang?: string | null;
    capped?: boolean;
  }

  const { code, lang, capped = false }: Props = $props();

  const PRE_CLASS = "px-2.5 py-2 font-mono text-body-sm";
  const LINE_STYLE = "line-height: var(--chat-line-code)";

  const feedback = new CopyFeedback();

  const body = $derived(code.replace(/\n+$/, ""));
  const resolved = $derived(resolveLang(lang));

  let html = $state<string | null>(null);

  $effect(() => {
    const language = resolved;
    const syntax = theme.syntax;
    if (!language) {
      html = null;
      return;
    }
    let active = true;
    highlight(body, language, syntax).then(
      (result) => {
        if (active) html = result;
      },
      () => {
        if (active) html = null;
      },
    );
    return () => {
      active = false;
    };
  });
</script>

<div class="w-full overflow-hidden rounded-panel bg-surface-nested">
  <div
    class="flex items-center pr-0.5 pl-2.5"
    style="padding-top: var(--chat-pad-xs)"
  >
    <span class="flex-1 text-label-md text-on-surface-variant select-none">{lang || "text"}</span>
    <button
      type="button"
      onclick={() => feedback.copy(body)}
      aria-label="copy"
      class="inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-hover"
    >
      {#if feedback.copied}
        <Check size={14} class="text-accent" />
      {:else}
        <Copy size={14} class="text-on-surface-variant" />
      {/if}
    </button>
  </div>
  {#if capped}
    <pre
      use:viewportScrollbar
      style={LINE_STYLE}
      class="{TEXT_VIEWPORT_CLASS} scrollbar-thin {CAPPED_HEIGHT} overflow-auto {PRE_CLASS}">{@render source()}</pre>
  {:else}
    <pre
      use:hscrollbar={{ touchIndicator: true }}
      style={LINE_STYLE}
      class="no-scrollbar overflow-x-auto {PRE_CLASS}">{@render source()}</pre>
  {/if}
</div>

{#snippet source()}<code>{#if html}{@html html}{:else}{body}{/if}</code>{/snippet}
