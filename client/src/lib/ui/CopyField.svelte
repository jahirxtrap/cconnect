<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import { t } from "$lib/i18n/index.svelte";
  import { CopyFeedback } from "./copyFeedback.svelte";
  import InputField from "./InputField.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Props {
    value: string;
    url?: boolean;
  }

  const { value, url = false }: Props = $props();

  const feedback = new CopyFeedback();
</script>

<InputField {value} oninput={() => {}} readonly singleLine {url}>
  {#snippet trailing()}
    <TooltipIconButton label={t("COPY")} tooltip={false} active={feedback.copied} onclick={() => feedback.copy(value)}>
      {#if feedback.copied}
        <Check />
      {:else}
        <Copy />
      {/if}
    </TooltipIconButton>
  {/snippet}
</InputField>
