<script lang="ts">
  import { CHAT_VIEW } from "$lib/app/screens";
  import type { ConnectionState } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ServerUnavailable from "$lib/ui/ServerUnavailable.svelte";

  interface Props {
    project: string | null;
    link: ConnectionState;
  }

  const { project, link }: Props = $props();

  const WELCOME_CLASS = "pointer-events-none absolute inset-0";
</script>

{#if link === "disconnected"}
  <ServerUnavailable class={WELCOME_CLASS} />
{:else if link === "connecting"}
  <CenteredProgress class={WELCOME_CLASS} />
{:else}
  <EmptyState icon={CHAT_VIEW.icon} text={project ? t("NEW_CHAT_IN", project) : t("NEW_CHAT")} class={WELCOME_CLASS} />
{/if}
