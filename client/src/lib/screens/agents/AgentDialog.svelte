<script lang="ts">
  import Lock from "@lucide/svelte/icons/lock";
  import { untrack } from "svelte";
  import {
    AGENT_PROTOCOLS,
    agentFailureText,
    envOf,
    envText,
    type AgentFailure,
    type AgentProtocol,
    type InstalledAgent,
  } from "$lib/data/agentModels";
  import { joined, linesOf, masked } from "$lib/data/format";
  import { keyRefused, type KeyGate } from "$lib/data/keyGate.svelte";
  import { securityKeys } from "$lib/data/securityKeys.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { agents } from "$lib/services/agents.svelte";
  import {
    createAgentsApi,
    MODEL_TOKEN,
    TASK_TOKEN,
    type AgentChanges,
    type CustomAgentFields,
  } from "$lib/services/agentsApi";
  import { backend } from "$lib/services/backend.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AgentLogDialog from "./AgentLogDialog.svelte";
  import { AGENT_KIND_LABELS, AGENT_PROTOCOL_LABELS } from "./agentLabels";

  interface Props {
    agent: InstalledAgent | null;
    gate: KeyGate;
    onDismiss: () => void;
  }

  const { agent, gate, onDismiss }: Props = $props();

  const api = createAgentsApi(() => backend.active);
  const initial = untrack(() => agent);

  let name = $state(initial?.name ?? "");
  let protocol = $state<AgentProtocol>(initial?.protocol ?? "acp");
  let purpose = $state(initial?.purpose ?? "");
  let program = $state(initial?.program ?? "");
  let args = $state(initial?.args.join("\n") ?? "");
  let editArgs = $state(initial?.editArgs.join("\n") ?? "");
  let bypassArgs = $state(initial?.bypassArgs.join("\n") ?? "");
  let modelArgs = $state(initial?.modelArgs.join("\n") ?? "");
  let enabled = $state(initial?.enabled ?? true);
  let env = $state<string | null>(initial?.envNames.length ? null : "");
  let locked = $state(false);
  let loadedEnv = "";
  let failed = $state<string | null>(null);
  let saving = $state(false);
  let logOpen = $state(false);

  const protocolOptions = AGENT_PROTOCOLS.map((value) => ({ value, label: t(AGENT_PROTOCOL_LABELS[value]) }));

  const custom = $derived(!agent || agent.source === "custom");
  const command = $derived(protocol === "command");
  const valid = $derived(!custom || (!!name.trim() && !!program.trim()));
  const kindLabel = $derived(agent?.kind ? AGENT_KIND_LABELS[agent.kind] : undefined);
  const subtitle = $derived(
    agent && !custom ? joined(agent.version && t("VERSION_LABEL", agent.version), kindLabel && t(kindLabel)) : null,
  );
  const hiddenEnv = $derived(agent?.envNames.map((envName) => `${envName}=${masked()}`).join("\n") ?? "");

  const report = (failure: AgentFailure | null) => {
    failed = failure ? agentFailureText(failure) : t("CONNECTION_ERROR");
  };

  const loadEnv = async (ask: boolean) => {
    if (!agent) return;
    const id = agent.id;
    const result = ask ? await gate.run((key) => api.env(id, key)) : await api.env(id, securityKeys.current);
    locked = keyRefused(result);
    if (result.ok) {
      loadedEnv = envText(result.value);
      env = loadedEnv;
    } else if (!locked) report(result.failure);
  };

  if (initial?.envNames.length) void loadEnv(false);

  const fields = (): CustomAgentFields => ({
    name: name.trim(),
    protocol,
    purpose: purpose.trim(),
    program: program.trim(),
    args: linesOf(args),
    edit_args: command ? linesOf(editArgs) : [],
    bypass_args: command ? linesOf(bypassArgs) : [],
    model_args: command ? linesOf(modelArgs) : [],
  });

  const changed = (current: Partial<CustomAgentFields>, saved: Partial<CustomAgentFields>): AgentChanges =>
    Object.fromEntries(
      Object.entries(current).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(saved[key as keyof CustomAgentFields])),
    );

  const changes = (target: InstalledAgent): AgentChanges => ({
    ...changed(custom ? fields() : { purpose: purpose.trim() }, {
      name: target.name,
      protocol: target.protocol,
      purpose: target.purpose,
      program: target.program,
      args: target.args,
      edit_args: target.editArgs,
      bypass_args: target.bypassArgs,
      model_args: target.modelArgs,
    }),
    ...(env !== null && env !== loadedEnv ? { env: envOf(env) } : {}),
    ...(enabled !== target.enabled ? { enabled } : {}),
  });

  const save = async () => {
    saving = true;
    failed = null;
    const result = agent
      ? await gate.run((key) => api.update(agent.id, changes(agent), key))
      : await gate.run((key) => api.add({ ...fields(), env: envOf(env ?? "") }, key));
    saving = false;
    if (!result.ok) {
      if (!keyRefused(result)) report(result.failure);
      return;
    }
    await agents.refresh(backend.active);
    onDismiss();
  };
</script>

<CompactDialog title={agent ? agent.name : t("AGENT_ADD")} {subtitle} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => void save()} enabled={valid && !saving}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex w-full flex-col gap-2">
    {#if agent?.description && !custom}
      <p class="text-body-md text-on-surface-variant">{agent.description}</p>
    {/if}
    {#if custom}
      <SelectField
        label={t("AGENT_PROTOCOL")}
        selected={protocol}
        options={protocolOptions}
        onSelect={(value) => (protocol = value as AgentProtocol)}
      />
      <InputField value={name} oninput={(value) => (name = value)} label={t("NAME")} singleLine autofocus={!agent} />
    {/if}
    <InputField value={purpose} oninput={(value) => (purpose = value)} label={t("PURPOSE")} optional minLines={2} />
    {#if custom}
      <InputField value={program} oninput={(value) => (program = value)} label={t("AGENT_PROGRAM")} singleLine />
      <div class="flex flex-col gap-1.5">
        <InputField value={args} oninput={(value) => (args = value)} label={t("AGENT_ARGS")} optional minLines={2} />
        {#if command}
          <p class="text-body-sm text-on-surface-variant">{t("AGENT_ARGS_HINT", TASK_TOKEN)}</p>
        {/if}
      </div>
      {#if command}
        <InputField
          value={editArgs}
          oninput={(value) => (editArgs = value)}
          label={t("AGENT_EDIT_ARGS")}
          optional
          minLines={2}
        />
        <div class="flex flex-col gap-1.5">
          <InputField
            value={bypassArgs}
            oninput={(value) => (bypassArgs = value)}
            label={t("AGENT_BYPASS_ARGS")}
            optional
            minLines={2}
          />
          <p class="text-body-sm text-on-surface-variant">{t("AGENT_MODE_ARGS_HINT")}</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <InputField
            value={modelArgs}
            oninput={(value) => (modelArgs = value)}
            label={t("AGENT_MODEL_ARGS")}
            optional
            minLines={2}
          />
          <p class="text-body-sm text-on-surface-variant">{t("AGENT_MODEL_ARGS_HINT", MODEL_TOKEN)}</p>
        </div>
      {/if}
    {/if}
    <InputField
      value={env ?? hiddenEnv}
      oninput={(value) => (env = value)}
      readonly={env === null}
      label={t("AGENT_ENV")}
      placeholder={t("AGENT_ENV_PLACEHOLDER")}
      optional
      minLines={2}
    >
      {#snippet trailing()}
        {#if locked}
          <TooltipIconButton label={t("UNLOCK")} onclick={() => void loadEnv(true)}>
            <Lock />
          </TooltipIconButton>
        {/if}
      {/snippet}
    </InputField>
    {#if agent}
      <SwitchRow
        title={t("AGENT_ENABLED")}
        summary={t(command ? "AGENT_COMMAND_ENABLED_SUMMARY" : "AGENT_ENABLED_SUMMARY")}
        checked={enabled}
        onChange={(value) => (enabled = value)}
      />
      {#if !command}
        <ActionButton text={t("AGENT_LOG")} onclick={() => (logOpen = true)} />
      {/if}
    {/if}
    {#if failed}
      <ErrorText text={failed} />
    {/if}
  </div>
</CompactDialog>

{#if logOpen && agent}
  <AgentLogDialog {agent} onDismiss={() => (logOpen = false)} />
{/if}
