<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import { t } from "$lib/i18n/index.svelte";
  import {
    conflicts,
    describe,
    keysIn,
    shortcuts,
    signature,
    SHORTCUTS,
    type ShortcutDef,
    type ShortcutKeys,
    type ShortcutScope,
  } from "$lib/platform/shortcuts.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const SCOPE_LABELS: Record<ShortcutScope, string> = {
    chat: "SCOPE_CHAT",
    terminal: "SCOPE_TERMINAL",
    files: "SCOPE_FILES",
    global: "SCOPE_GENERAL",
  };

  const ORDER: ShortcutScope[] = ["chat", "terminal", "files", "global"];

  const MODIFIER_CODES = [
    "ControlLeft",
    "ControlRight",
    "AltLeft",
    "AltRight",
    "ShiftLeft",
    "ShiftRight",
    "MetaLeft",
    "MetaRight",
  ];

  const groups = ORDER.map((scope) => ({
    scope,
    items: SHORTCUTS.filter((shortcut) => shortcut.scope === scope),
  })).filter((group) => group.items.length > 0);

  let draft = $state<ShortcutKeys>({ ...shortcuts.custom });
  let capturing = $state<string | null>(null);
  let clash = $state<ShortcutDef[]>([]);

  const capture = (event: KeyboardEvent) => {
    if (!capturing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Escape") {
      draft = { ...draft, [capturing]: "" };
      clash = [];
      capturing = null;
      return;
    }
    if (MODIFIER_CODES.includes(event.code)) return;
    const keys = signature(event);
    clash = conflicts(capturing, keys, draft);
    draft = { ...draft, [capturing]: keys };
    capturing = null;
  };

  $effect(() => {
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  });

  const start = (id: string) => {
    capturing = capturing === id ? null : id;
    clash = [];
  };

  const clear = (id: string) => {
    const { [id]: _dropped, ...rest } = draft;
    draft = rest;
    clash = [];
  };

  const save = () => {
    shortcuts.replace(draft);
    onDismiss();
  };
</script>

<CompactDialog title={t("SHORTCUTS")} {onDismiss}>
  {#snippet buttons()}
    <Button
      onclick={() => {
        draft = {};
        clash = [];
      }}
      enabled={Object.keys(draft).length > 0}
      variant="outlined"
    >
      {t("RESET")}
    </Button>
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex w-full flex-col gap-1">
    <p class="text-body-sm text-on-surface-variant">{t("SHORTCUTS_HINT")}</p>
    {#each groups as group (group.scope)}
      <p class="mt-1 mb-1.5 text-label-lg">{t(SCOPE_LABELS[group.scope])}</p>
      {#each group.items as shortcut (shortcut.id)}
        <div class="flex items-center pr-1">
          <Pressable
            onclick={() => start(shortcut.id)}
            class="flex min-w-0 flex-1 items-center gap-3 rounded-item px-2 py-2 text-left"
          >
            <span class="min-w-0 flex-1 truncate text-body-md">{t(shortcut.label)}</span>
            <span
              class="shrink-0 rounded-sm px-2 py-0.5 text-body-sm {capturing === shortcut.id
                ? 'bg-accent text-on-accent'
                : 'text-on-surface-variant'}"
            >
              {capturing === shortcut.id
                ? t("SHORTCUTS_PRESS")
                : describe(keysIn(shortcut.id, draft)) || t("SHORTCUTS_UNASSIGNED")}
            </span>
          </Pressable>
          <TooltipIconButton
            label={t("RESET")}
            enabled={draft[shortcut.id] !== undefined}
            class="size-8 [&_svg]:size-4"
            onclick={() => clear(shortcut.id)}
          >
            <RotateCcw />
          </TooltipIconButton>
        </div>
      {/each}
    {/each}
    {#if clash.length}
      <p class="text-body-sm text-red">
        {t("SHORTCUTS_CONFLICT", clash.map((shortcut) => t(shortcut.label)).join(", "))}
      </p>
    {/if}
  </div>
</CompactDialog>
