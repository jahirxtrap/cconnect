import { invoke } from "@tauri-apps/api/core";
import { settings } from "$lib/data/settings.svelte";
import { plural, t } from "$lib/i18n/index.svelte";
import { isDesktop } from "$lib/platform";
import { panes } from "$lib/screens/chat/panes.svelte";
import { tabs } from "$lib/screens/chat/tabs.svelte";
import { backend } from "$lib/services/backend.svelte";

const MIN_INTERVAL_MS = 15_000;
const SEPARATOR = " · ";

interface Lines {
  details: string | null;
  state: string | null;
  started_at: number | null;
  small_image: string | null;
  small_text: string | null;
}

type Stage = "working" | "waiting" | "idle";

const STAGE_LABEL: Record<Stage, string> = {
  working: "DISCORD_WORKING",
  waiting: "DISCORD_WAITING",
  idle: "DISCORD_IDLE",
};

const folderName = (cwd: string) => cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;

export function presenceLines(): Lines | null {
  const prefs = settings.discord;
  if (!prefs.enabled) return null;

  const running = tabs.list.filter((tab) => tab.running);
  const tab = panes.focusedTab ?? null;
  const chat = tab ? tabs.stateFor(tab) : null;
  const stage: Stage = running.length ? "working" : chat?.activity === "waiting" ? "waiting" : "idle";
  if (stage === "idle" && prefs.hideIdle) return null;

  const subject = prefs.chatTitle ? (tab?.title ?? null) : prefs.project ? folderName(tab?.cwd ?? "") : null;
  const action = t(STAGE_LABEL[prefs.status ? stage : "working"]);
  let details = subject ? t("DISCORD_ON", action, subject) : action;
  if (running.length > 1) details = `${details} ${plural("DISCORD_CHATS", running.length, running.length)}`;

  const pieces: string[] = [];
  if (prefs.environment) {
    const name = backend.find(tab?.environmentId ?? null)?.name;
    if (name) pieces.push(name);
  }
  const model = chat?.effectiveModel;
  if (prefs.model && model) {
    pieces.push(chat?.capabilities?.models.find((item) => item.id === model)?.label ?? model);
  }

  return {
    details,
    state: pieces.length ? pieces.join(SEPARATOR) : null,
    started_at: prefs.time && stage === "working" ? startedAt : null,
    small_image: prefs.status ? stage : null,
    small_text: prefs.status ? t(STAGE_LABEL[stage]) : null,
  };
}

let startedAt: number | null = null;
let lastSentAt = 0;
let pending: Lines | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let previous = "";

const push = (lines: Lines) => {
  lastSentAt = Date.now();
  pending = null;
  void invoke("presence_set", { lines });
};

const schedule = (lines: Lines) => {
  const signature = JSON.stringify(lines);
  if (signature === previous) return;
  previous = signature;

  const wait = MIN_INTERVAL_MS - (Date.now() - lastSentAt);
  if (wait <= 0) {
    push(lines);
    return;
  }
  pending = lines;
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    if (pending) push(pending);
  }, wait);
};

const stop = () => {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  pending = null;
  previous = "";
  startedAt = null;
  void invoke("presence_clear");
};

export function watchPresence() {
  if (!isDesktop) return;

  $effect(() => {
    if (!settings.discord.enabled) return;
    const busy = tabs.list.some((tab) => tab.running);
    if (busy && startedAt === null) startedAt = Date.now();
    if (!busy) startedAt = null;
  });

  $effect(() => {
    const lines = presenceLines();
    if (!lines) {
      if (previous) stop();
      return;
    }
    schedule(lines);
  });

  return () => stop();
}
