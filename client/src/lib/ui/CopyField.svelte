<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import { t } from "$lib/i18n/index.svelte";
  import { copyText } from "$lib/platform/clipboard";
  import InputField from "./InputField.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Props {
    value: string;
    url?: boolean;
  }

  const { value, url = false }: Props = $props();

  const COPIED_MS = 1000;

  let copied = $state(false);

  $effect(() => {
    if (!copied) return;
    const timer = setTimeout(() => (copied = false), COPIED_MS);
    return () => clearTimeout(timer);
  });

  const copy = () => {
    void copyText(value);
    copied = true;
  };
</script>

<InputField {value} oninput={() => {}} readonly singleLine {url}>
  {#snippet trailing()}
    <TooltipIconButton label={t("COPY")} tooltip={false} active={copied} onclick={copy}>
      {#if copied}
        <Check />
      {:else}
        <Copy />
      {/if}
    </TooltipIconButton>
  {/snippet}
</InputField>
