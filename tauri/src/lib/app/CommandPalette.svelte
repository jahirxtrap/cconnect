<script lang="ts">
  import { Dialog } from "bits-ui";
  import { tick } from "svelte";
  import { collectCommands, filterCommands, type CommandGroup } from "$lib/app/commands.svelte";
  import { pushDismiss } from "$lib/app/dismissStack";
  import { t } from "$lib/i18n/index.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  const GROUP_LABELS: Record<CommandGroup, string> = {
    action: "COMMANDS_ACTIONS",
    screen: "COMMANDS_SCREENS",
    chat: "CHATS",
    project: "PROJECTS",
    settings: "SETTINGS",
  };

  const commands = collectCommands();

  let query = $state("");
  let active = $state(0);

  const matches = $derived(filterCommands(commands, query));

  const groups = $derived(
    [...new Set(matches.map((command) => command.group))].map((group) => ({
      group,
      items: matches.filter((command) => command.group === group),
    })),
  );

  const launch = async (index: number) => {
    const command = matches[index];
    if (!command) return;
    onDismiss();
    await tick();
    command.run();
  };

  const move = (delta: number) => {
    if (!matches.length) return;
    active = (active + delta + matches.length) % matches.length;
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Enter") void launch(active);
    else return;
    event.preventDefault();
  };

  $effect(() => {
    void query;
    active = 0;
  });

  $effect(() => pushDismiss(() => onDismiss()));
</script>

<Dialog.Root open onOpenChange={(value) => !value && onDismiss()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-60 bg-black/60" />
    <Dialog.Content
      class="menu-surface fixed inset-x-0 top-24 z-60 mx-auto flex max-h-[min(30rem,70%)] w-[min(36rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-lg border-2 border-outline-variant bg-surface shadow-xl"
    >
      <Dialog.Title class="sr-only">{t("COMMANDS")}</Dialog.Title>
      <div class="shrink-0 p-2">
        <SearchBar
          value={query}
          oninput={(value) => (query = value)}
          placeholder={t("COMMANDS_SEARCH")}
          autofocus
          onkeydown={onKeydown}
        />
      </div>
      <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {#each groups as section, index (section.group)}
          <SectionHeader label={t(GROUP_LABELS[section.group])} divider={index > 0} />
          {#each section.items as command (command.id)}
            {@const index = matches.indexOf(command)}
            <Pressable
              onclick={() => void launch(index)}
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-body-md {index ===
              active
                ? 'bg-on-surface/10'
                : ''}"
            >
              {#if command.icon}
                <command.icon size={18} class="shrink-0" />
              {/if}
              <span class="min-w-0 flex-1 truncate text-left">{command.label}</span>
              {#if command.detail}
                <span class="min-w-0 shrink truncate text-body-sm text-on-surface-variant">
                  {command.detail}
                </span>
              {/if}
              {#if command.hint}
                <span class="shrink-0 text-body-sm text-on-surface-variant">{command.hint}</span>
              {/if}
            </Pressable>
          {/each}
        {:else}
          <EmptyState text={t("NO_RESULTS")} class="py-8" />
        {/each}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
