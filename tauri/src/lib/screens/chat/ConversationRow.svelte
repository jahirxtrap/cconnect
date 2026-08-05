<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";

  interface Props {
    title: string;
    selected: boolean;
    onOpen: () => void;
    onRename: () => void;
    onAutoRename: () => void;
    onColor: () => void;
    onDelete: () => void;
  }

  const { title, selected, onOpen, onRename, onAutoRename, onColor, onDelete }: Props = $props();

  let menu = $state(false);

  const run = (action: () => void) => {
    menu = false;
    action();
  };
</script>

<div
  class="group flex items-center rounded-item pr-1 transition-colors hover:bg-on-surface/6 {selected
    ? 'bg-on-surface/10'
    : ''}"
  oncontextmenu={(event) => {
    event.preventDefault();
    menu = true;
  }}
  role="presentation"
>
  <Pressable
    onclick={onOpen}
    onlongclick={() => (menu = true)}
    hover={false}
    class="min-w-0 flex-1 truncate px-2 py-2 text-body-md"
  >
    {title}
  </Pressable>
  <div>
    <PopupMenu open={menu} align="end" onOpenChange={(value) => (menu = value)}>
      {#snippet trigger()}
        <span
          class="inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/10"
        >
          <EllipsisVertical size={16} class="text-on-surface-variant" />
        </span>
      {/snippet}
      <MenuItem text={t("RENAME")} onclick={() => run(onRename)} />
      <MenuItem text={t("AUTO_RENAME")} onclick={() => run(onAutoRename)} />
      <MenuItem text={t("CONVERSATION_COLOR")} onclick={() => run(onColor)} />
      <MenuItem text={t("DELETE")} onclick={() => run(onDelete)} />
    </PopupMenu>
  </div>
</div>
