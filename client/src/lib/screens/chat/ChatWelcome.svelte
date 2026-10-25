<script lang="ts">
  import { CHAT_VIEW } from "$lib/app/screens";
  import { t } from "$lib/i18n/index.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";

  interface Props {
    project: string | null;
    unavailable: boolean;
  }

  const { project, unavailable }: Props = $props();

  const WELCOME_CLASS = "pointer-events-none absolute inset-0";
</script>

{#if unavailable}
  <ServerUnavailable class={WELCOME_CLASS} />
{:else}
  <EmptyState icon={CHAT_VIEW.icon} text={project ? t("NEW_CHAT_IN", project) : t("NEW_CHAT")} class={WELCOME_CLASS} />
{/if}
