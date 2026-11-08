<script lang="ts">
  import type { CurrentSession } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import InfoRow from "$lib/ui/InfoRow.svelte";

  interface Props {
    session: CurrentSession;
  }

  const { session }: Props = $props();

  const facts = $derived(
    [
      { label: t("SESSION_ID"), value: session.sessionId },
      { label: t("WORKING_FOLDER"), value: session.cwd },
      { label: t("ACCOUNT"), value: session.account },
      { label: t("ACCOUNT_EMAIL"), value: session.email },
      { label: t("ACCOUNT_PLAN"), value: session.plan },
      { label: t("MODEL"), value: session.model },
      { label: t("EFFORT"), value: session.effort },
      { label: t("PERMISSIONS"), value: session.permissionMode },
    ].flatMap(({ label, value }) => (value ? [{ label, value }] : [])),
  );
</script>

<div class="flex flex-col gap-2.5">
  {#each facts as fact (fact.label)}
    <InfoRow label={fact.label} value={fact.value} />
  {/each}
</div>
