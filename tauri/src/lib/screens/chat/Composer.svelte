<script lang="ts">
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import Hourglass from "@lucide/svelte/icons/hourglass";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import Plus from "@lucide/svelte/icons/plus";
  import Slash from "@lucide/svelte/icons/slash";
  import Square from "@lucide/svelte/icons/square";
  import X from "@lucide/svelte/icons/x";
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";
  import type { QueuedMessage } from "$lib/data/chatModels";
  import { isArchive } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import type { CommandOption } from "$lib/services/capabilitiesApi";
  import Chip from "$lib/ui/Chip.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import MenuSub from "$lib/ui/MenuSub.svelte";
  import type { Attachment } from "./state.svelte";

  interface Props {
    streaming: boolean;
    draft: string;
    onDraft: (value: string) => void;
    attachments: Attachment[];
    uploading: boolean;
    queue: QueuedMessage[];
    onOpenQueued: (item: QueuedMessage) => void;
    commands: CommandOption[];
    pendingInput: string | null;
    onConsumePending: () => string | null;
    onSend: (text: string) => void;
    onInterrupt: () => void;
    onAttach: (files: File[]) => void;
    onRemoveAttachment: (id: number) => void;
    onCloseSide?: (() => void) | null;
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
    pendingInput,
    onConsumePending,
    onSend,
    onInterrupt,
    onAttach,
    onRemoveAttachment,
    onCloseSide = null,
    controls,
  }: Props = $props();

  const PERCENT = 100;

  const queueLabel = (item: QueuedMessage) =>
    item.text || item.attachments.map((path) => path.split(/[\\/]/).pop()).join(", ");

  let field = $state<HTMLTextAreaElement | null>(null);
  let picker = $state<HTMLInputElement | null>(null);
  let menu = $state(false);

  const canSend = $derived(!uploading && (!!draft.trim() || attachments.length > 0));

  const submit = () => {
    if (!canSend) return;
    onSend(draft);
    onDraft("");
  };

  const insertCommand = (name: string) => {
    onDraft(`/${name} `);
    menu = false;
    field?.focus();
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

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (layout.touch) return;
    event.preventDefault();
    submit();
  };

  const focusField = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
    field?.focus();
  };

  const onpaste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length) return;
    event.preventDefault();
    onAttach(files);
  };
</script>

<div class="shrink-0 p-3">
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    onclick={focusField}
    class="cursor-text rounded-lg border border-outline-variant bg-surface focus-within:border-outline"
  >
    {#if queue.length}
      <div class="no-scrollbar flex gap-1.5 overflow-x-auto px-3.5 pt-3">
        {#each queue as item (item.id)}
          <Chip name={queueLabel(item)} icon={Hourglass} onclick={() => onOpenQueued(item)} />
        {/each}
      </div>
    {/if}

    {#if attachments.length}
      <div class="no-scrollbar flex gap-1.5 overflow-x-auto px-3.5 {queue.length ? 'pt-1.5' : 'pt-3'}">
        {#each attachments as item (item.id)}
          <Chip name={item.name} icon={isArchive(item.name) ? FolderArchive : FileIcon}>
            {#snippet trailing()}
              {#if uploading}
                <span class="shrink-0 text-label-md text-on-surface-variant">
                  {Math.round(item.progress * PERCENT)}%
                </span>
              {:else}
                <button
                  type="button"
                  onclick={() => onRemoveAttachment(item.id)}
                  aria-label={t("DELETE")}
                  class="shrink-0 cursor-pointer text-on-surface-variant hover:text-on-surface"
                >
                  <X size={14} />
                </button>
              {/if}
            {/snippet}
          </Chip>
        {/each}
      </div>
    {/if}

    <div class="px-3.5 {attachments.length ? 'pt-2.5' : 'pt-3.5'}">
      <textarea
        bind:this={field}
        value={draft}
      oninput={(event) => onDraft((event.currentTarget as HTMLTextAreaElement).value)}
        {onkeydown}
        {onpaste}
        rows="1"
        placeholder={t("TYPE_MESSAGE")}
        class="field-auto no-scrollbar max-h-36 w-full resize-none bg-transparent text-body-lg caret-accent outline-none placeholder:text-on-surface-variant"
      ></textarea>
    </div>

    <div class="no-scrollbar flex items-center gap-1 overflow-x-auto px-2.5 pt-1.5 pb-2.5">
      {#if onCloseSide}
        <button
          type="button"
          onclick={onCloseSide}
          aria-label={t("CLOSE")}
          title={t("CLOSE")}
          class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-variant text-on-surface-variant transition-colors hover:bg-on-surface/10"
        >
          <X size={18} />
        </button>
      {/if}
      <DropdownMenu.Root open={menu} onOpenChange={(open) => (menu = open)}>
        <DropdownMenu.Trigger
          disabled={!!onCloseSide}
          class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8 disabled:hidden"
          aria-label={t("ATTACH_FILES")}
        >
          <Plus size={18} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="start"
            sideOffset={6}
            class="menu-surface z-50 max-h-(--bits-dropdown-menu-content-available-height) min-w-48 overflow-y-auto rounded-md border border-outline-variant bg-surface-variant p-1 shadow-lg"
          >
            <MenuItem text={t("ATTACH_FILES")} onclick={() => picker?.click()}>
              {#snippet leading()}
                <Paperclip size={16} class="shrink-0 text-on-surface-variant" />
              {/snippet}
            </MenuItem>
            {#if commands.length}
              <MenuSub text={t("COMMANDS")}>
                {#snippet leading()}
                  <Slash size={16} class="shrink-0 text-on-surface-variant" />
                {/snippet}
                {#each commands as command (command.name)}
                  <MenuItem text="/{command.name}" onclick={() => insertCommand(command.name)} />
                {/each}
              </MenuSub>
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {@render controls?.()}
      <div class="flex-1"></div>

      {#if streaming}
        <button
          type="button"
          onclick={onInterrupt}
          aria-label={t("STOP")}
          title={t("STOP")}
          class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent transition-opacity hover:opacity-90"
        >
          <Square size={13} class="fill-current" />
        </button>
      {/if}
      <button
        type="button"
        disabled={!canSend}
        onclick={submit}
        aria-label={t("SEND")}
        title={t("SEND")}
        class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-30"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  </div>

  <input bind:this={picker} type="file" multiple onchange={pick} class="hidden" />
</div>
