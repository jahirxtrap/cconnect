<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { tabs } from "$lib/screens/chat/tabs.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import AccountsSection from "./AccountsSection.svelte";
  import type { ClaudeKind } from "./ClaudeDetail.svelte";
  import ClaudeCliSection from "./ClaudeCliSection.svelte";
  import ClaudeExtensionsSection from "./ClaudeExtensionsSection.svelte";
  import ClaudeStatusSection from "./ClaudeStatusSection.svelte";
  import ClaudeUsageSection from "./ClaudeUsageSection.svelte";

  interface Props {
    tick?: number;
    flashCli?: boolean;
    onOpen: (kind: ClaudeKind) => void;
    onAccountsChanged: () => void;
  }

  const { tick = 0, flashCli = false, onOpen, onAccountsChanged }: Props = $props();

  const chat = $derived(tabs.state);
  const serverReady = $derived(backend.configured && chat.connected);
  const pending = $derived(chat.link === "disconnected" ? t("SERVER_UNAVAILABLE") : t("LOADING"));
</script>

<ClaudeStatusSection enabled={serverReady} {pending} {tick} onOpen={() => onOpen("status")} />

<ClaudeCliSection enabled={serverReady} {tick} {pending} flash={flashCli} />

<ClaudeUsageSection {tick} {pending} />

<AccountsSection enabled={serverReady} onChanged={onAccountsChanged} />

<ClaudeExtensionsSection enabled={serverReady} {pending} {tick} {onOpen} />
