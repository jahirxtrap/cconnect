<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import { t } from "$lib/i18n/index.svelte";
  import { CHIP_ICON_SIZE } from "./toolbarChips";
  import ToolbarToggle from "./ToolbarToggle.svelte";

  interface Props {
    simpleMode: boolean;
    onVisibility: () => void;
  }

  const { simpleMode, onVisibility }: Props = $props();
</script>

<ToolbarToggle label={t("VISIBILITY")} onclick={onVisibility}>
  {#if simpleMode}
    <EyeOff size={CHIP_ICON_SIZE} class="text-accent" />
  {:else}
    <Eye size={CHIP_ICON_SIZE} class="text-accent" />
  {/if}
</ToolbarToggle>
