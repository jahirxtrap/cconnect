<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import CreditCard from "@lucide/svelte/icons/credit-card";
  import Folder from "@lucide/svelte/icons/folder";
  import Gauge from "@lucide/svelte/icons/gauge";
  import Hash from "@lucide/svelte/icons/hash";
  import Mail from "@lucide/svelte/icons/mail";
  import Shield from "@lucide/svelte/icons/shield";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import type { CurrentSession } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import InfoRow from "$lib/ui/InfoRow.svelte";

  interface Props {
    session: CurrentSession;
  }

  const { session }: Props = $props();

  const facts = $derived(
    [
      { icon: Hash, label: t("SESSION_ID"), value: session.sessionId },
      { icon: Folder, label: t("WORKING_FOLDER"), value: session.cwd },
      { icon: CircleUser, label: t("ACCOUNT"), value: session.account },
      { icon: Mail, label: t("ACCOUNT_EMAIL"), value: session.email },
      { icon: CreditCard, label: t("ACCOUNT_PLAN"), value: session.plan },
      { icon: Sparkles, label: t("MODEL"), value: session.model },
      { icon: Gauge, label: t("EFFORT"), value: session.effort },
      { icon: Shield, label: t("PERMISSIONS"), value: session.permissionMode },
    ].flatMap(({ icon, label, value }) => (value ? [{ icon, label, value }] : [])),
  );
</script>

<div class="flex flex-col gap-2.5">
  {#each facts as fact (fact.label)}
    <InfoRow icon={fact.icon} label={fact.label} value={fact.value} />
  {/each}
</div>
