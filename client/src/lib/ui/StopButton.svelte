<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { keepFocus } from "./keepFocus";
  import { ROUND_BUTTON_CLASS } from "./roundButton";
  import StopIcon from "./StopIcon.svelte";

  interface Props {
    onclick: () => void;
  }

  const { onclick }: Props = $props();

  const GLYPH = 14;
</script>

<button
  type="button"
  use:keepFocus
  {onclick}
  aria-label={t("STOP")}
  title={t("STOP")}
  class="{ROUND_BUTTON_CLASS} bg-surface-variant text-on-surface"
>
  <StopIcon size={GLYPH} />
</button>
