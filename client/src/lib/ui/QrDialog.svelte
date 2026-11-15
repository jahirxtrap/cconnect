<script lang="ts" module>
  export interface QrChoice {
    label: string;
    text: string;
    hint: string;
  }
</script>

<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import QrCode from "./QrCode.svelte";
  import SegmentedButtons from "./SegmentedButtons.svelte";

  interface Props {
    title: string;
    choices: QrChoice[];
    onDismiss: () => void;
  }

  const { title, choices, onDismiss }: Props = $props();

  let selected = $state(0);

  const shown = $derived(choices[Math.min(selected, choices.length - 1)]);
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  <div class="flex flex-col items-center gap-4">
    {#if choices.length > 1}
      <SegmentedButtons
        options={choices.map((choice) => choice.label)}
        {selected}
        onSelect={(index) => (selected = index)}
        shortcuts={false}
        fill
      />
    {/if}
    <QrCode text={shown.text} />
    <p class="text-center text-body-sm text-on-surface-variant">{shown.hint}</p>
  </div>
</CompactDialog>
