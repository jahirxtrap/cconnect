<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import { theme } from "$lib/design/theme.svelte";
  import { highlight, resolveLang } from "$lib/markdown/highlighter";
  import { hscrollbar } from "./scrollbar";

  interface Props {
    code: string;
    lang?: string | null;
  }

  const { code, lang }: Props = $props();

  const COPIED_MS = 1000;

  const body = $derived(code.replace(/\n+$/, ""));
  const resolved = $derived(resolveLang(lang));

  let html = $state<string | null>(null);
  let copied = $state(false);

  $effect(() => {
    const language = resolved;
    const dark = theme.dark;
    if (!language) {
      html = null;
      return;
    }
    let active = true;
    void highlight(body, language, dark).then((result) => {
      if (active) html = result;
    });
    return () => {
      active = false;
    };
  });

  $effect(() => {
    if (!copied) return;
    const timer = setTimeout(() => (copied = false), COPIED_MS);
    return () => clearTimeout(timer);
  });

  const copy = () => {
    void navigator.clipboard.writeText(body);
    copied = true;
  };
</script>

<div class="w-full overflow-hidden rounded-panel bg-surface-variant">
  <div class="flex items-center pt-0.5 pr-0.5 pl-2.5">
    <span class="flex-1 text-label-md text-on-surface-variant select-none">{lang || "code"}</span>
    <button
      type="button"
      onclick={copy}
      aria-label="copy"
      class="inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8"
    >
      {#if copied}
        <Check size={14} class="text-accent" />
      {:else}
        <Copy size={14} class="text-on-surface-variant" />
      {/if}
    </button>
  </div>
  <pre
    use:hscrollbar
    class="no-scrollbar overflow-x-auto px-2.5 py-2 font-mono text-body-sm leading-snug"><code
      >{#if html}{@html html}{:else}{body}{/if}</code
    ></pre>
</div>
