<script lang="ts">
  import { encode } from "uqr";
  import { t } from "$lib/i18n/index.svelte";

  interface Props {
    text: string;
  }

  const { text }: Props = $props();

  const code = $derived(encode(text, { border: 0 }));
  const modules = $derived(
    code.data.map((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")).join("")).join(""),
  );
</script>

<span class="flex size-52 shrink-0 rounded-lg bg-white p-4 text-black">
  <svg viewBox="0 0 {code.size} {code.size}" shape-rendering="crispEdges" role="img" aria-label={t("QR_CODE")} class="size-full">
    <path fill="currentColor" d={modules} />
  </svg>
</span>
