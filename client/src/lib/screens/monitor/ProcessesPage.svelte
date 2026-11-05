<script lang="ts">
  import Cpu from "@lucide/svelte/icons/cpu";
  import Power from "@lucide/svelte/icons/power";
  import Server from "@lucide/svelte/icons/server";
  import { PANE_VIEWS } from "$lib/app/screens";
  import { chatListFor } from "$lib/data/chatList.svelte";
  import { KeyGate } from "$lib/data/keyGate.svelte";
  import { formatDecimal, formatSize, joined } from "$lib/data/format";
  import { projectNameOf } from "$lib/data/models";
  import { settings } from "$lib/data/settings.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import type { IconSource } from "$lib/ui/icons";
  import ListRow from "$lib/ui/ListRow.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import SecurityKeyDialog from "$lib/ui/SecurityKeyDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import {
    PROCESS_KINDS,
    systemApi,
    type ProcessEntry,
    type ProcessesSnapshot,
    type ProcessKind,
    type ProcessPart,
    type ProcessUsage,
    type SystemInfo,
  } from "$lib/services/systemApi";
  import { formatUptime } from "./monitor.svelte";
  import UsageSplit from "./UsageSplit.svelte";

  interface Props {
    snapshot: ProcessesSnapshot;
    info: SystemInfo;
  }

  const { snapshot, info }: Props = $props();

  const MILLIS_PER_SECOND = 1000;
  const PERCENT = 100;
  const CHILD_PADDING = "py-1.5 pl-9 pr-3";
  const CARD_CLASS = "rounded-lg bg-card p-3.5";

  const VIEWS: Record<ProcessKind, string> = {
    server: "",
    chat: "chat",
    agent: "agents",
    terminal: "terminal",
    browser: "browser",
    other: "",
  };

  const OWN_ICONS: Partial<Record<ProcessKind, IconSource>> = { server: Server };

  const LABELS: Record<ProcessKind, string> = {
    server: "SETTINGS_SERVER",
    chat: "CHATS",
    agent: "AGENTS",
    terminal: "TERMINALS",
    browser: "BROWSER",
    other: "OTHER_PROCESSES",
  };

  const ACTIVITIES: Record<string, string> = {
    working: "WORKING",
    retrying: "WORKING",
    compacting: "COMPACTING",
    waiting: "WAITING_USER",
    persistent: "PERSISTENT_ALIVE",
  };

  const gate = new KeyGate();

  let expanded = $state<Record<number, boolean>>({});
  let stopping = $state<Record<number, boolean>>({});
  let confirming = $state<ProcessEntry | null>(null);

  const locked = $derived(settings.lockedProject);
  const processes = $derived(locked ? snapshot.items.filter((item) => item.projectKey === locked) : snapshot.items);
  const total = (field: "cpu" | "memory") => processes.reduce((sum, item) => sum + item[field], 0);
  const ownName = $derived(
    locked ? projectNameOf(chatListFor(backend.active)?.projects ?? [], locked) : t("APP_NAME"),
  );

  const now = $derived.by(() => {
    void snapshot;
    return Date.now() / MILLIS_PER_SECOND;
  });

  const groups = $derived(
    PROCESS_KINDS.map((kind) => ({ kind, items: processes.filter((item) => item.kind === kind) })).filter(
      (group) => group.items.length,
    ),
  );

  const ownCpu = $derived(Math.min(locked ? total("cpu") : snapshot.cpu, info.cpuPercent));
  const ownMemory = $derived(Math.min(locked ? total("memory") : snapshot.memory, info.memoryUsed));

  const iconOf = (kind: ProcessKind): IconSource =>
    OWN_ICONS[kind] ?? PANE_VIEWS.find((view) => view.kind === VIEWS[kind])?.icon ?? Cpu;

  const titleOf = (item: ProcessEntry) => {
    if (item.kind === "server") return t("APP_NAME");
    if (item.kind === "chat") return item.title || t("NEW_CHAT");
    if (item.kind === "browser") return t("BROWSER");
    return item.title || item.name;
  };

  const subtitleOf = (item: ProcessEntry) =>
    joined(
      item.detail,
      item.activity && ACTIVITIES[item.activity] ? t(ACTIVITIES[item.activity]) : null,
      formatUptime(Math.max(0, now - item.started)),
      item.processes.length > 1 ? plural("PROCESSES_COUNT", item.processes.length) : null,
    );

  const partsOf = (item: ProcessEntry): ProcessPart[] =>
    item.parts.length ? item.parts : item.processes.map((entry) => ({ ...entry, detail: null, count: 1, role: null }));

  const partTitle = (part: ProcessPart) => (part.role === "quick_chat" ? t("QUICK_CHAT") : part.name);

  const partSubtitle = (part: ProcessPart) =>
    joined(part.detail, part.count > 1 ? plural("PROCESSES_COUNT", part.count) : `PID ${part.pid}`);

  const toggle = (pid: number) => (expanded = { ...expanded, [pid]: !expanded[pid] });

  const stop = async (item: ProcessEntry) => {
    stopping = { ...stopping, [item.pid]: true };
    const result = await gate.run((key) => systemApi.stopProcess(item.pid, key));
    if (!result.ok) stopping = { ...stopping, [item.pid]: false };
  };

  const percent = (value: number) => `${formatDecimal(value, 1)}%`;
</script>

{#snippet usage(entry: ProcessUsage)}
  <div class="flex shrink-0 flex-col items-end text-right tabular-nums">
    <span class="text-body-sm">{percent(entry.cpu)}</span>
    <span class="text-caption text-on-surface-variant">{formatSize(entry.memory)}</span>
  </div>
{/snippet}

<div use:viewportScrollbar class="rounded-viewport min-h-0 flex-1 overflow-y-auto px-(--page-inset) pb-(--page-inset)">
  <div class="flex flex-col gap-3.5 {CARD_CLASS}">
    <UsageSplit
      title="CPU"
      value={percent(info.cpuPercent)}
      own={ownCpu / PERCENT}
      rest={(info.cpuPercent - ownCpu) / PERCENT}
      ownLabel={joined(ownName, percent(ownCpu))}
      restLabel={joined(t("PROCESSES_REST"), percent(info.cpuPercent - ownCpu))}
    />
    <UsageSplit
      title={t("MEMORY")}
      value="{formatSize(info.memoryUsed)} / {formatSize(info.memoryTotal)}"
      own={info.memoryTotal ? ownMemory / info.memoryTotal : 0}
      rest={info.memoryTotal ? (info.memoryUsed - ownMemory) / info.memoryTotal : 0}
      ownLabel={joined(ownName, formatSize(ownMemory))}
      restLabel={joined(t("PROCESSES_REST"), formatSize(info.memoryUsed - ownMemory))}
    />
  </div>

  {#if !processes.length}
    <EmptyState icon={Cpu} text={t("NO_PROCESSES")} class="py-10" />
  {/if}

  {#each groups as group (group.kind)}
    <SettingsGroup label={t(LABELS[group.kind])}>
      {#each group.items as item (item.pid)}
        <ListRow
          icon={iconOf(item.kind)}
          title={titleOf(item)}
          subtitle={subtitleOf(item)}
          onclick={partsOf(item).length > 1 ? () => toggle(item.pid) : undefined}
        >
          {#snippet trailing()}
            <div class="flex items-center gap-2">
              {@render usage(item)}
              {#if item.stop}
                <TooltipIconButton label={t("STOP")} enabled={!stopping[item.pid]} onclick={() => (confirming = item)}>
                  <Power />
                </TooltipIconButton>
              {/if}
            </div>
          {/snippet}
        </ListRow>
        {#if expanded[item.pid]}
          {#each partsOf(item) as part (part.pid)}
            <ListRow title={partTitle(part)} subtitle={partSubtitle(part)} padding={CHILD_PADDING}>
              {#snippet trailing()}
                {@render usage(part)}
              {/snippet}
            </ListRow>
          {/each}
        {/if}
      {/each}
    </SettingsGroup>
  {/each}
</div>

{#if confirming}
  {@const target = confirming}
  <ConfirmDialog
    title={t("STOP")}
    text={t("STOP_PROCESS_CONFIRM", titleOf(target))}
    confirmLabel={t("STOP")}
    danger
    onConfirm={() => {
      void stop(target);
      confirming = null;
    }}
    onDismiss={() => (confirming = null)}
  />
{/if}

{#if gate.asking}
  <SecurityKeyDialog rejected={gate.rejected} onConfirm={(key) => gate.confirm(key)} onDismiss={() => gate.dismiss()} />
{/if}
