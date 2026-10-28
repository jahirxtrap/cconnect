<script lang="ts">
  import { agentFailureText, type AgentLogin, type AgentMethod } from "$lib/data/agentModels";
  import { KeyGate, keyRefused } from "$lib/data/keyGate.svelte";
  import { terminalTabs } from "$lib/data/terminalTabs.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { createAgentsApi } from "$lib/services/agentsApi";
  import Button from "$lib/ui/Button.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import AgentsDialog from "$lib/screens/agents/AgentsDialog.svelte";
  import { panes } from "./panes.svelte";
  import type { ChatState } from "./state.svelte";

  interface Props {
    chat: ChatState;
  }

  const { chat }: Props = $props();

  const SETUP_REASONS = ["missing", "node", "platform"];
  const LOGIN_FAILED = "login";

  const gate = new KeyGate();

  let login = $state<{ method: AgentMethod; command: AgentLogin } | null>(null);
  let failed = $state<string | null>(null);
  let managing = $state(false);

  const api = $derived(createAgentsApi(() => chat.environment));
  const current = $derived(chat.agentState);
  const TITLES: Record<string, string> = {
    auth: "AGENT_SIGN_IN",
    error: "AGENT_START_FAILED",
    closed: "AGENT_CLOSED",
  };

  const title = $derived(current ? TITLES[current.status] : undefined);
  const signIn = $derived(current?.status === "auth");
  const problem = $derived(
    current?.status === "error" || (current?.status === "auth" && current.reason === LOGIN_FAILED)
      ? agentFailureText({ reason: current.reason ?? "", detail: current.detail })
      : "",
  );

  const quoted = (arg: string) => (/[\s"']/.test(arg) ? JSON.stringify(arg) : arg);

  const commandText = (command: AgentLogin) =>
    [...Object.entries(command.env).map(([name, value]) => `${name}=${quoted(value)}`), command.command.map(quoted).join(" ")].join(
      "\n",
    );

  const reportFailure = (failure: { reason: string; detail: string } | null) => {
    failed = failure ? agentFailureText(failure) : t("CONNECTION_ERROR");
  };

  const choose = async (method: AgentMethod) => {
    failed = null;
    if (!method.terminal) {
      chat.agentLogin(method.id);
      return;
    }
    if (!chat.agent) return;
    const agent = chat.agent;
    const result = await gate.run((key) => api.loginPreview(agent, method.id, chat.cwd, key));
    if (result.ok) login = { method, command: result.value };
    else if (!keyRefused(result)) reportFailure(result.failure);
  };

  const runLogin = async (method: AgentMethod) => {
    login = null;
    if (!chat.agent) return;
    const agent = chat.agent;
    const result = await gate.run((key) => api.login(agent, method.id, chat.cwd, key));
    if (!result.ok) {
      if (!keyRefused(result)) reportFailure(result.failure);
      return;
    }
    terminalTabs.openLocal(result.value);
    panes.show("terminal");
  };
</script>

{#if current && title}
  <div class="pb-2">
    <CardPanel>
      <p class="text-label-lg text-accent">{t(title, chat.agentName)}</p>
      {#if problem}
        <MarkdownText text={problem} dense class="selectable mt-1 text-on-surface-variant" />
      {/if}
      {#if failed}
        <ErrorText text={failed} class="mt-1" />
      {/if}
      <div class="mt-2 flex flex-wrap gap-2">
        {#if signIn}
          {#each current.methods as method (method.id)}
            <Button variant="outlined" onclick={() => void choose(method)}>{method.name}</Button>
          {/each}
          <Button variant="outlined" onclick={() => chat.agentRetry()}>{t("AGENT_SIGNED_IN")}</Button>
        {:else}
          <Button variant="outlined" onclick={() => chat.agentRetry()}>{t("RETRY")}</Button>
          {#if SETUP_REASONS.includes(current.reason ?? "")}
            <Button variant="outlined" onclick={() => (managing = true)}>{t("AGENTS_MANAGE")}</Button>
          {/if}
        {/if}
      </div>
    </CardPanel>
  </div>
{/if}

{#if login}
  {@const target = login}
  <CompactDialog title={target.method.name} onDismiss={() => (login = null)}>
    {#snippet buttons()}
      <Button onclick={() => (login = null)} variant="outlined">{t("CANCEL")}</Button>
      <Button onclick={() => void runLogin(target.method)}>{t("AGENT_LOGIN_RUN")}</Button>
    {/snippet}
    <div class="flex flex-col gap-2">
      <p class="text-body-md text-on-surface-variant">{target.method.description || t("AGENT_LOGIN_TERMINAL")}</p>
      <CodeBlock code={commandText(target.command)} />
    </div>
  </CompactDialog>
{/if}

{#if managing}
  <AgentsDialog onDismiss={() => (managing = false)} />
{/if}

{#if gate.asking}
  <SecurityKeyDialog rejected={gate.rejected} onConfirm={(key) => gate.confirm(key)} onDismiss={() => gate.dismiss()} />
{/if}
