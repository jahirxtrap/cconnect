<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { BrowserFavorite } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import AppTitle from "$lib/ui/AppTitle.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import BrowserTabIcon from "./BrowserTabIcon.svelte";

  interface Props {
    favorites: BrowserFavorite[];
    nameOf: (favorite: BrowserFavorite) => string;
    onSearch: (input: string) => void;
    onAdd: () => void;
    onRename: (favorite: BrowserFavorite, title: string) => void;
    onRemove: (favorite: BrowserFavorite) => void;
  }

  const { favorites, nameOf, onSearch, onAdd, onRename, onRemove }: Props = $props();

  const TITLE_SCALE = 1.25;
  const ADD_ICON_SIZE = 20;
  const TILE = "items-center gap-2";
  const BADGE = "flex size-10 items-center justify-center rounded-lg bg-surface-variant text-on-surface-variant";
  const LABEL = "w-full truncate text-center text-body-sm";

  let query = $state("");
  let menuUrl = $state<string | null>(null);
  let renaming = $state<BrowserFavorite | null>(null);

  const submit = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !query.trim()) return;
    event.preventDefault();
    onSearch(query);
  };
</script>

<div class="scrollbar-thin absolute inset-0 overflow-y-auto bg-background [--c-card:var(--c-surface)]">
  <div class="flex min-h-full flex-col items-center justify-center gap-8 p-6">
    <AppTitle scale={TITLE_SCALE} />
    <InputField
      value={query}
      oninput={(next) => (query = next)}
      onkeydown={submit}
      onClear={() => (query = "")}
      placeholder={t("BROWSER_ADDRESS")}
      singleLine
      url
      enterKeyHint="go"
      class="w-full max-w-xl"
    />
    <div class="grid w-full max-w-xl grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
      {#each favorites as favorite (favorite.url)}
        <div class="relative">
          <CardPanel
            onclick={() => onSearch(favorite.url)}
            onlongclick={() => (menuUrl = favorite.url)}
            oncontextmenu={() => (menuUrl = favorite.url)}
            class={TILE}
          >
            <span class={BADGE}>
              <BrowserTabIcon src={favorite.icon} large />
            </span>
            <span class={LABEL}>{nameOf(favorite)}</span>
          </CardPanel>
          <div class="absolute top-1 right-1">
            <PopupMenu
              open={menuUrl === favorite.url}
              label={t("MORE_OPTIONS")}
              onOpenChange={(open) => (menuUrl = open ? favorite.url : null)}
            >
              {#snippet triggerChild(props)}
                <TooltipIconButton label={t("MORE_OPTIONS")} class="size-6" {...props}>
                  <EllipsisVertical />
                </TooltipIconButton>
              {/snippet}
              <MenuItem icon={Pencil} text={t("RENAME")} onclick={() => (renaming = favorite)} />
              <MenuItem icon={Trash2} danger text={t("DELETE")} onclick={() => onRemove(favorite)} />
            </PopupMenu>
          </div>
        </div>
      {/each}
      <CardPanel onclick={onAdd} class={TILE}>
        <span class={BADGE}>
          <Plus size={ADD_ICON_SIZE} class="shrink-0" />
        </span>
        <span class={LABEL}>{t("ADD")}</span>
      </CardPanel>
    </div>
  </div>
</div>

{#if renaming}
  {@const target = renaming}
  <RenameDialog
    initial={nameOf(target)}
    onConfirm={(title) => {
      onRename(target, title);
      renaming = null;
    }}
    onDismiss={() => (renaming = null)}
  />
{/if}
