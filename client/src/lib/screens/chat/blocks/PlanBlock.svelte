<script lang="ts">
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import { t } from "$lib/i18n/index.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import Collapsible from "./Collapsible.svelte";

  interface Props {
    markdown: string;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    onSharedLink?: (url: string, filename: string) => void;
  }

  const { markdown, expanded = null, onToggle = null, onSharedLink }: Props = $props();

  const preview = $derived(
    (markdown.split("\n").find((line) => line.trim()) ?? "").trim().replace(/^[#\s]+/, ""),
  );
</script>

<Collapsible
  label={t("PLAN")}
  icon={Lightbulb}
  {preview}
  {expanded}
  {onToggle}
  bodyClass="pt-1.5"
>
  <MarkdownText text={markdown} {onSharedLink} />
</Collapsible>
