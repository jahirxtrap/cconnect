<script lang="ts">
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import { t } from "$lib/i18n/index.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    markdown: string;
    onSharedLink?: (url: string, filename: string) => void;
  }

  const { markdown, onSharedLink }: Props = $props();

  const preview = $derived(
    (markdown.split("\n").find((line) => line.trim()) ?? "").trim().replace(/^[#\s]+/, ""),
  );
</script>

<Collapsible
  label={t("PLAN")}
  icon={Lightbulb}
  {preview}
  labelClass="text-accent"
  bodyClass="mt-1.5"
>
  <div class="w-full rounded-sm bg-surface-variant px-3 py-2.5">
    <MarkdownText text={markdown} {onSharedLink} />
  </div>
</Collapsible>
