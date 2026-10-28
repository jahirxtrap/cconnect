<script lang="ts">
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import { t } from "$lib/i18n/index.svelte";
  import EmptyState from "./EmptyState.svelte";

  interface Props {
    loading?: boolean;
    class?: string;
  }

  const { loading = false, class: className = "" }: Props = $props();
</script>

<EmptyState {loading} icon={TriangleAlert} text={t("CONNECTION_ERROR")} class={className} />
