<script lang="ts">
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import Hourglass from "@lucide/svelte/icons/hourglass";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import SquareSlash from "@lucide/svelte/icons/square-slash";
  import X from "@lucide/svelte/icons/x";
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";
  import type { QueuedMessage } from "$lib/data/chatModels";
  import { isArchive } from "$lib/data/format";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import type { CommandOption } from "$lib/services/capabilitiesApi";
  import Chip from "$lib/ui/Chip.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuScrim from "$lib/ui/MenuScrim.svelte";
  import ProgressRing from "$lib/ui/ProgressRing.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import StopIcon from "$lib/ui/StopIcon.svelte";
  import type { Attachment } from "./state.svelte";
  import { MENU_CONTENT_CLASS } from "$lib/ui/menuSurface";
  import { pastedName } from "$lib/data/pastedFile";

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
  let picker = $state<HTMLInputElement | null>(null);
  let menu = $state(false);

  const canSubmit = $derived(!!draft.trim() || attachments.length > 0);
  const busy = $derived(streaming || uploading);
  const commandsReady = $derived(commands.length > 0 && !streaming);

  const submit = () => {
    if (!canSubmit) return;
    onSend(draft);
    onDraft("");
  };

  const runCommand = (command: CommandOption) => {
    menu = false;
    onCommand(command);
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
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey || event.ctrlKey || event.metaKey) insertNewline();
    else submit();
  };

  const focusField = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
    field?.focus();
  };

  const onpaste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData?.files ?? []).map(pastedName);
    if (!files.length) return;
    event.preventDefault();
    onAttach(files);
  };
</script>

<div class="shrink-0 p-3">
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    onclick={focusField}
    style={accent ? `border-color: ${accent}` : undefined}
    class="cursor-text rounded-lg border bg-surface {accent ? '' : 'border-outline-variant'}"
  >
    {#if queue.length}
      <div
        use:hscrollbar={{ touchIndicator: false, wheel: true }}
        class="no-scrollbar flex gap-1.5 overflow-x-auto px-3.5 pt-3"
      >
        {#each queue as item (item.id)}
          <Chip name={queueLabel(item)} icon={Hourglass} onclick={() => onOpenQueued(item)} />
        {/each}
      </div>
    {/if}

    {#if attachments.length}
      <div
        use:hscrollbar={{ touchIndicator: false, wheel: true }}
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
      oninput={(event) => onDraft((event.currentTarget as HTMLTextAreaElement).value)}
        {onkeydown}
        {onpaste}
        rows="1"
        placeholder={t("TYPE_MESSAGE")}
        class="field-auto no-scrollbar block max-h-36 w-full resize-none bg-transparent text-body-lg caret-accent outline-none placeholder:text-on-surface-variant"
      ></textarea>
    </div>

    <div class="flex items-center gap-1 px-2.5 pt-1.5 pb-2.5">
      {#if onCloseSide}
        <button
          type="button"
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
          onclick={() => picker?.click()}
          aria-label={t("ATTACH_FILES")}
          title={t("ATTACH_FILES")}
          class="{ROUND_CLASS} bg-surface-variant text-on-surface-variant disabled:cursor-default"
        >
          <Paperclip size={18} />
        </button>
        <MenuScrim open={menu} onDismiss={() => (menu = false)} />
        <DropdownMenu.Root open={menu} onOpenChange={(open) => (menu = open)}>
          <DropdownMenu.Trigger
            disabled={!commandsReady}
            aria-label={t("COMMANDS")}
            title={t("COMMANDS")}
            class="{ROUND_CLASS} bg-surface-variant text-on-surface-variant disabled:cursor-default"
          >
            <SquareSlash size={18} class={commandsReady ? "" : "opacity-[0.38]"} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="start"
              sideOffset={6}
              class={MENU_CONTENT_CLASS}
            >
              {#each commands as command (command.name)}
                <MenuItem
                  text="/{command.name}"
                  description={command.description}
                  onclick={() => runCommand(command)}
                />
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      {/if}

      {#if controls}
        {@render controls()}
      {:else}
        <div class="flex-1"></div>
      {/if}

      {#if busy}
        <button
          type="button"
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
