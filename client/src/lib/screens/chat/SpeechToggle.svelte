<script lang="ts">
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import { t } from "$lib/i18n/index.svelte";
  import { speech } from "$lib/platform/speech.svelte";
  import { CHIP_ICON_SIZE } from "./toolbarChips";
  import ToolbarToggle from "./ToolbarToggle.svelte";
</script>

{#if speech.speaking}
  <ToolbarToggle label={t("SPEECH_STOP")} pressed onclick={() => speech.stop()}>
    <Volume2 size={CHIP_ICON_SIZE} class="text-accent" />
  </ToolbarToggle>
{/if}
