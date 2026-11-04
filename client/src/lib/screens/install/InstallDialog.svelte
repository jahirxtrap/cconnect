<script lang="ts">
  import { untrack } from "svelte";
  import { agentFailureText, type CatalogAgent } from "$lib/data/agentModels";
  import { installTarget, skillName, type McpConfig } from "$lib/data/installRequest";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { agents } from "$lib/services/agents.svelte";
  import { createAgentsApi } from "$lib/services/agentsApi";
  import { backend, environmentOptions } from "$lib/services/backend.svelte";
  import { createClaudeApi, type ActionResult } from "$lib/services/claudeApi";
  import { createHttp } from "$lib/services/http";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import FactList from "$lib/ui/FactList.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import { SECTION_LABEL_CLASS } from "$lib/ui/sectionLabel";
  import SelectField from "$lib/ui/SelectField.svelte";
  import { INSTALL_LABELS, installName } from "./installKinds";
  import type { ConfirmedInstall } from "./installOffers.svelte";

  interface Props {
    request: ConfirmedInstall | null;
    onDismiss: () => void;
  }

  const { request, onDismiss }: Props = $props();

  const NOT_FOUND = 404;

  let environmentId = $state(untrack(() => backend.active?.id ?? ""));
  const environment = $derived(backend.find(environmentId));
  const choosable = $derived(backend.environments.length > 1 && !settings.environmentLocked);
  const claude = createClaudeApi(createHttp(() => environment), () => environment);
  const agentsApi = createAgentsApi(() => environment);
  const initial = untrack(() => request);
  const fields =
    initial?.kind === "mcp" ? (initial.config.type === "stdio" ? initial.config.env : initial.config.headers) : {};

  let values = $state<Record<string, string>>({ ...fields });
  let replaces = $state(false);
  let agent = $state<CatalogAgent | null>(null);
  let loading = $state(initial !== null);
  let busy = $state(false);
  let failure = $state<string | null>(initial ? null : t("INSTALL_LINK_INVALID"));

  const lookup = (target: ConfirmedInstall): Promise<() => void> | null => {
    switch (target.kind) {
      case "mcp":
        return claude.mcp().then((servers) => () => {
          replaces = (servers ?? []).some((server) => server.name === target.name);
        });
      case "skill":
        return claude.skills().then((skills) => () => {
          replaces = (skills ?? []).some((skill) => !skill.plugin && skill.id === skillName(target));
        });
      case "agent":
        return agentsApi.catalog().then((found) => () => {
          agent = found.value?.find((item) => item.id === target.id) ?? null;
          if (!agent) failure = found.ok ? t("INSTALL_AGENT_MISSING", target.id) : t("CONNECTION_ERROR");
        });
      default:
        return null;
    }
  };

  $effect(() => {
    const target = initial;
    const profile = environment;
    const pending = profile && target ? lookup(target) : null;
    if (!pending) {
      loading = false;
      return;
    }
    let current = true;
    loading = true;
    failure = null;
    void pending.then((apply) => {
      if (!current) return;
      apply();
      loading = false;
    });
    return () => {
      current = false;
    };
  });

  const facts = (target: ConfirmedInstall) => {
    switch (target.kind) {
      case "mcp":
        return [
          { label: t("NAME"), text: target.name },
          { label: t("TRANSPORT"), text: target.config.type },
          { label: t("COMMAND_OR_URL"), text: installTarget(target) },
        ];
      case "plugin":
        return [
          { label: t("NAME"), text: target.plugin },
          { label: t("MARKETPLACE"), text: target.marketplace },
          { label: t("INSTALL_SOURCE"), text: target.source },
        ];
      case "marketplace":
        return [{ label: t("INSTALL_SOURCE"), text: target.source }];
      case "agent":
        return [
          { label: t("NAME"), text: agent?.name ?? target.id },
          { label: t("VERSION"), text: agent?.version ?? null },
        ];
      case "skill":
        return [
          { label: t("NAME"), text: skillName(target) },
          { label: t("INSTALL_SOURCE"), text: target.source },
          { label: t("INSTALL_FOLDER"), text: target.path },
          { label: t("INSTALL_BRANCH"), text: target.ref },
        ];
    }
  };

  const rows = $derived.by(() => {
    if (!request) return [];
    const shown = choosable ? [] : [{ label: t("ENVIRONMENT"), text: environment?.name ?? null }];
    return [...facts(request), ...shown].filter((row) => row.text);
  });

  const configured = (config: McpConfig): McpConfig =>
    config.type === "stdio" ? { ...config, env: { ...values } } : { ...config, headers: { ...values } };

  const run = async (target: ConfirmedInstall): Promise<ActionResult> => {
    switch (target.kind) {
      case "mcp": {
        if (replaces) {
          const removed = await claude.mcpRemove(target.name);
          if (!removed.ok) return removed;
        }
        const added = await claude.mcpAddConfig(target.name, configured(target.config));
        return added.status === NOT_FOUND ? { ok: false, message: t("COMPAT_SERVER_OUTDATED") } : added;
      }
      case "plugin": {
        const known = (await claude.extensions())?.marketplaces.some((item) => item.name === target.marketplace);
        if (!known) {
          if (!target.source) return { ok: false, message: t("INSTALL_MARKETPLACE_MISSING", target.marketplace) };
          const added = await claude.marketplaceAction("add", target.source);
          if (!added.ok) return added;
        }
        return claude.pluginAction("install", installTarget(target));
      }
      case "marketplace":
        return claude.marketplaceAction("add", target.source);
      case "agent": {
        const installed = await agentsApi.install(target.id);
        if (installed.ok) void agents.refresh();
        return { ok: installed.ok, message: installed.failure ? agentFailureText(installed.failure) : "" };
      }
      case "skill": {
        const added = await claude.skillInstall(target.source, target.path, target.ref);
        return added.status === NOT_FOUND ? { ok: false, message: t("COMPAT_SERVER_OUTDATED") } : added;
      }
    }
  };

  const install = async () => {
    if (!request) return;
    busy = true;
    failure = null;
    const result = await run(request);
    busy = false;
    if (result.ok) onDismiss();
    else failure = result.message || t("CONNECTION_ERROR");
  };
</script>

{#snippet progress()}
  <LinearProgress />
{/snippet}

<CompactDialog
  title={t(request ? INSTALL_LABELS[request.kind] : "INSTALL")}
  header={busy || loading ? progress : undefined}
  {onDismiss}
>
  {#snippet buttons()}
    {#if !request}
      <Button onclick={onDismiss}>{t("CLOSE")}</Button>
    {:else}
      <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
      <Button enabled={!busy && !loading && (request.kind !== "agent" || !!agent)} onclick={() => void install()}>
        {t("INSTALL")}
      </Button>
    {/if}
  {/snippet}
  <div class="flex w-full flex-col gap-3.5">
    {#if request?.kind === "agent" && agent?.description}
      <p class="text-body-md text-on-surface-variant">{agent.description}</p>
    {/if}
    <FactList {rows} />
    {#if choosable}
      <SelectField
        label={t("ENVIRONMENT")}
        selected={environment?.id ?? ""}
        options={environmentOptions()}
        enabled={!busy}
        onSelect={(id) => (environmentId = id)}
      />
    {/if}
    {#if Object.keys(fields).length}
      <div class="flex flex-col gap-2.5">
        <p class={SECTION_LABEL_CLASS}>
          {t(request?.kind === "mcp" && request.config.type === "stdio" ? "MCP_ENV" : "MCP_HEADERS")}
        </p>
        {#each Object.keys(fields) as key (key)}
          <InputField
            value={values[key] ?? ""}
            oninput={(value) => (values[key] = value)}
            label={key}
            enabled={!busy}
            singleLine
          />
        {/each}
      </div>
    {/if}
    {#if request}
      {#if replaces}
        <p class="text-body-sm text-on-surface-variant">{t("INSTALL_REPLACES", installName(request))}</p>
      {/if}
      <p class="text-body-sm text-on-surface-variant">{t("INSTALL_LINK_NOTE")}</p>
    {/if}
    {#if failure}
      <ErrorText text={failure} />
    {/if}
  </div>
</CompactDialog>
