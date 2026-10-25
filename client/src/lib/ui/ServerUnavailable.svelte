<script lang="ts">
  import ServerOff from "@lucide/svelte/icons/server-off";
  import { t } from "$lib/i18n/index.svelte";
  import EmptyState from "./EmptyState.svelte";

  interface Props {
    class?: string;
  }

  const { class: className = "" }: Props = $props();
</script>

<EmptyState icon={ServerOff} text={t("SERVER_UNAVAILABLE")} class={className} />
