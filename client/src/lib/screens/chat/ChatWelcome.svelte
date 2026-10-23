<script lang="ts">
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import { t } from "$lib/i18n/index.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";

  interface Props {
    path: string;
  }

  const { path }: Props = $props();

  const name = $derived(path.split(/[\\/]/).filter(Boolean).pop() ?? "");
</script>

<EmptyState
  icon={SquareTerminal}
  text={name ? t("NEW_CHAT_IN", name) : t("NEW_CHAT")}
  class="pointer-events-none absolute inset-0"
/>
