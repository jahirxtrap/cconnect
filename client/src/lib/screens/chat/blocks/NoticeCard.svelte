<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconSource } from "$lib/ui/icons";
  import { TINT_CLASS, TINT_TEXT_CLASS, type Tint } from "./tint";

  interface Props {
    tone: Tint;
    icon: IconSource;
    title: string;
    detail?: string | null;
    children?: Snippet;
  }

  const { tone, icon: Icon, title, detail = null, children }: Props = $props();

  const GLYPH = 14;
</script>

<div class="w-full px-(--page-inset)">
  <div class="rounded-panel px-3 py-2.5 {TINT_CLASS[tone]}">
    <div class="flex items-start gap-2.5 {TINT_TEXT_CLASS[tone]}">
      <span class="flex h-5 shrink-0 items-center"><Icon size={GLYPH} /></span>
      <div class="min-w-0 flex-1 text-block wrap-anywhere">
        <p>{title}</p>
        {#if detail}
          <p>{detail}</p>
        {/if}
      </div>
    </div>
    {@render children?.()}
  </div>
</div>
