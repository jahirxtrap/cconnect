<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import { claudeRefresh } from "$lib/data/claudeRefresh.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { useShortcut } from "$lib/platform/useShortcut.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  useShortcut("window.refresh", () => void claudeRefresh.run());
</script>

<TooltipIconButton
  label={t("REFRESH")}
  shortcut="window.refresh"
  onclick={() => void claudeRefresh.run()}
>
  <RotateCw />
</TooltipIconButton>
