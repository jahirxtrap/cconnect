<script lang="ts">
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import Hourglass from "@lucide/svelte/icons/hourglass";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import SquareSlash from "@lucide/svelte/icons/square-slash";
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import type { QueuedMessage } from "$lib/data/chatModels";
  import { isArchive } from "$lib/data/format";
  import { paneFocus } from "$lib/data/paneFocus.svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import { commandToken, type CommandOption } from "$lib/services/capabilitiesApi";
  import Chip from "$lib/ui/Chip.svelte";
  import ProgressRing from "$lib/ui/ProgressRing.svelte";
  import { hasFiles } from "$lib/ui/fileDrop";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import StopIcon from "$lib/ui/StopIcon.svelte";
  import type { Attachment } from "./state.svelte";
  import { pastedName } from "$lib/data/pastedFile";
  import { keepFocus } from "$lib/ui/keepFocus";

  interface Props {
    streaming: boolean;
    draft: string;
    onDraft: (value: string) => void;
    attachments: Attachment[];
    uploading: boolean;
    queue: QueuedMessage[];
    onOpenQueued: (item: QueuedMessage) => void;
    commands: CommandOption[];
    onCommand: (command: CommandOption) => void;
    pendingInput: string | null;
    onConsumePending: () => string | null;
    onSend: (text: string) => void;
    onInterrupt: () => void;
    onAttach: (files: File[]) => void;
    onRemoveAttachment: (id: number) => void;
    onCloseSide?: (() => void) | null;
    sessionColor?: string | null;
    controls?: Snippet;
  }

  const {
    streaming,
    draft,
    onDraft,
    attachments,
    uploading,
    queue,
    onOpenQueued,
    commands,
    onCommand,
    pendingInput,
    onConsumePending,
    onSend,
    onInterrupt,
    onAttach,
    onRemoveAttachment,
    onCloseSide = null,
    sessionColor = null,
    controls,
  }: Props = $props();

  const ROUND_CLASS =
    "ripple inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full";

  const accent = $derived(sessionColorOf(sessionColor));

  const queueLabel = (item: QueuedMessage) =>
    item.text || item.attachments.map((path) => path.split(/[\\/]/).pop()).join(", ");

  let field = $state<HTMLTextAreaElement | null>(null);

  $effect(() => paneFocus.register("chat", () => field?.focus()));
  let picker = $state<HTMLInputElement | null>(null);

  const canSubmit = $derived(!!draft.trim() || attachments.length > 0);
  const busy = $derived(streaming || uploading);
  const commandsReady = $derived(commands.length > 0 && !streaming);

  const submit = () => {
    if (!canSubmit) return;
    typed = null;
    onSend(draft);
    onDraft("");
  };

  let typed = $state<string | null>(null);
  let highlighted = $state(0);
  let previewed = $state(false);
  let argumentFor = $state<CommandOption | null>(null);

  const write = (value: string) => {
    onDraft(value);
    if (field) field.value = value;
  };

  const openCommands = () => {
    if (!draft.trimStart().startsWith("/")) write("/");
    typed = commandToken(field?.value ?? draft);
    highlighted = 0;
    previewed = false;
    field?.focus();
  };

  const matches = (command: CommandOption, token: string) =>
    command.name.toLowerCase().includes(token) ||
    command.aliases.some((alias) => alias.toLowerCase().includes(token));

  const resolve = (text: string) => {
    const body = text.trim();
    if (!body.startsWith("/")) return null;
    const token = body.slice(1).split(/\s+/)[0].toLowerCase();
    return (
      commands.find(
        (command) =>
          command.name.toLowerCase() === token ||
          command.aliases.some((alias) => alias.toLowerCase() === token),
      ) ?? null
    );
  };

  const suggestions = $derived.by(() => {
    if (!commandsReady) return [];
    if (argumentFor) return [argumentFor];
    const token = typed;
    if (token === null) return [];
    return commands.filter((command) => matches(command, token.toLowerCase()));
  });

  const oninput = (event: Event) => {
    const value = (event.currentTarget as HTMLTextAreaElement).value;
    onDraft(value);
    const token = commandToken(value);
    typed = token;
    const command = token === null ? resolve(value) : null;
    argumentFor = command?.argumentHint ? command : null;
    highlighted = 0;
    previewed = false;
  };

  const cycle = (step: number, keepFirst = false) => {
    if (!suggestions.length) return;
    if (!keepFirst || previewed) {
      highlighted = (highlighted + step + suggestions.length) % suggestions.length;
    }
    previewed = true;
    const command = suggestions[highlighted];
    write(command.argumentHint ? `/${command.name} ` : `/${command.name}`);
  };

  const complete = (command: CommandOption) => {
    typed = null;
    write(command.argumentHint ? `/${command.name} ` : "");
    field?.focus();
    if (!command.argumentHint) onCommand(command);
  };

  const pick = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    onAttach(Array.from(input.files ?? []));
    input.value = "";
  };

  $effect(() => {
    if (pendingInput === null) return;
    const restored = onConsumePending();
    if (restored === null) return;
    onDraft(restored);
    field?.focus();
  });

  const insertNewline = () => {
    if (!field) return;
    const { selectionStart, selectionEnd, value } = field;
    const updated = `${value.slice(0, selectionStart)}\n${value.slice(selectionEnd)}`;
    onDraft(updated);
    field.value = updated;
    field.selectionStart = selectionStart + 1;
    field.selectionEnd = selectionStart + 1;
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (suggestions.length && !argumentFor) {
      if (event.key === "Tab") {
        event.preventDefault();
        cycle(event.shiftKey ? -1 : 1, true);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        cycle(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter" && !isTouch && !event.shiftKey) {
        event.preventDefault();
        complete(suggestions[highlighted]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        typed = null;
        return;
      }
    }
    if (event.key !== "Enter" || isTouch) return;
    event.preventDefault();
    if (event.shiftKey || event.ctrlKey || event.metaKey) insertNewline();
    else submit();
  };

  const focusField = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
    field?.focus();
  };

  const ondragenter = (event: DragEvent) => {
    if (!hasFiles(event)) field?.focus();
  };

  const onpaste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData?.files ?? []).map(pastedName);
    if (!files.length) return;
    event.preventDefault();
    onAttach(files);
  };
</script>

<div class="relative shrink-0 p-3">
  {#if suggestions.length}
    <div
      class="scrollbar-thin absolute inset-x-3 bottom-[calc(100%-0.75rem)] z-40 mb-1.5 max-h-64 overflow-y-auto rounded-lg border-2 border-outline-variant bg-surface py-1 shadow-lg"
    >
      {#each suggestions as command, index (command.name)}
        <button
          type="button"
          use:keepFocus
          onclick={() => complete(command)}
          onmouseenter={() => (highlighted = index)}
          class="ripple flex w-full min-w-0 cursor-pointer flex-col items-start px-3.5 py-2 text-left {index ===
          highlighted
            ? 'bg-on-surface/8'
            : ''}"
        >
          <span class="w-full truncate text-body-md">
            /{command.name}{#if command.argumentHint}&nbsp;<span class="text-on-surface-variant"
                >{command.argumentHint}</span
              >{/if}
          </span>
          {#if command.description}
            <span class="w-full truncate text-body-sm text-on-surface-variant">{command.description}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    onclick={focusField}
    style={accent ? `border-color: ${accent}` : undefined}
    class="cursor-text rounded-lg border-2 bg-surface {accent ? '' : 'border-outline-variant'}"
  >
    {#if queue.length}
      <div
        use:hscrollbar={{ wheel: true }}
        class="no-scrollbar flex gap-1.5 overflow-x-auto px-3.5 pt-3"
      >
        {#each queue as item (item.id)}
          <Chip name={queueLabel(item)} icon={Hourglass} onclick={() => onOpenQueued(item)} />
        {/each}
      </div>
    {/if}

    {#if attachments.length}
      <div
        use:hscrollbar={{ wheel: true }}
        class="no-scrollbar flex gap-1.5 overflow-x-auto px-3.5 {queue.length ? 'pt-1.5' : 'pt-3'}"
      >
        {#each attachments as item (item.id)}
          <Chip name={item.name} icon={isArchive(item.name) ? FolderArchive : FileIcon}>
            {#snippet trailing()}
              {#if uploading}
                <ProgressRing value={item.progress} size={16} stroke={2} />
              {:else}
                <button
                  type="button"
                  onclick={() => onRemoveAttachment(item.id)}
                  aria-label={t("DELETE")}
                  class="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
                >
                  <X size={16} />
                </button>
              {/if}
            {/snippet}
          </Chip>
        {/each}
      </div>
    {/if}

    <div class="px-3.5 {queue.length || attachments.length ? 'pt-1.5' : 'pt-3.5'}">
      <textarea
        bind:this={field}
        value={draft}
      {oninput}
        {onkeydown}
        {onpaste}
        {ondragenter}
        rows="1"
        placeholder={t("TYPE_MESSAGE")}
        class="field-auto no-scrollbar block max-h-36 w-full resize-none bg-transparent text-body-lg caret-accent outline-none placeholder:text-on-surface-variant"
      ></textarea>
    </div>

    <div class="flex items-center gap-1 px-2.5 pt-1.5 pb-2.5">
      {#if onCloseSide}
        <button
          type="button"
          use:keepFocus
          onclick={onCloseSide}
          aria-label={t("CLOSE")}
          title={t("CLOSE")}
          class="{ROUND_CLASS} bg-surface-variant text-on-surface-variant"
        >
          <X size={18} />
        </button>
      {:else}
        <button
          type="button"
          disabled={uploading}
          use:keepFocus
          onclick={() => picker?.click()}
          aria-label={t("ATTACH_FILES")}
          title={t("ATTACH_FILES")}
          class="{ROUND_CLASS} bg-surface-variant text-on-surface-variant disabled:cursor-default"
        >
          <Paperclip size={18} />
        </button>
        <button
          type="button"
          use:keepFocus
          onclick={openCommands}
          aria-label={t("COMMANDS")}
          title={t("COMMANDS")}
          class="{ROUND_CLASS} bg-surface-variant text-on-surface-variant"
        >
          <SquareSlash size={18} />
        </button>
      {/if}

      {#if controls}
        {@render controls()}
      {:else}
        <div class="flex-1"></div>
      {/if}

      {#if busy}
        <button
          type="button"
          use:keepFocus
          onclick={onInterrupt}
          aria-label={t("STOP")}
          title={t("STOP")}
          class="{ROUND_CLASS} bg-surface-variant text-on-surface"
        >
          <StopIcon size={14} />
        </button>
      {/if}
      <button
        type="button"
        disabled={!canSubmit}
        use:keepFocus
        onclick={submit}
        aria-label={t("SEND")}
        title={t("SEND")}
        class="{ROUND_CLASS} {canSubmit
          ? 'bg-accent text-on-accent'
          : 'bg-surface-variant text-on-surface-variant'} disabled:cursor-default"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  </div>

  <input bind:this={picker} type="file" multiple onchange={pick} class="hidden" />
</div>
