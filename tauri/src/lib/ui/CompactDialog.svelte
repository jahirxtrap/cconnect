<script lang="ts">
  import { Dialog } from "bits-ui";
  import type { Snippet } from "svelte";
  import { pushDismiss } from "$lib/app/dismissStack";

  interface Props {
    title: string;
    onDismiss: () => void;
    description?: string | null;
    padded?: boolean;
    titleTrailing?: Snippet;
    header?: Snippet;
    buttons?: Snippet;
    children?: Snippet;
  }

  const {
    title,
    onDismiss,
    description,
    padded = true,
    titleTrailing,
    header,
    buttons,
    children,
  }: Props = $props();

  $effect(() => pushDismiss(() => onDismiss()));
</script>

<Dialog.Root open onOpenChange={(open) => !open && onDismiss()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-60 bg-black/60" />
    <Dialog.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      class="menu-surface fixed inset-0 z-60 m-auto flex h-max max-h-[min(40rem,85%)] w-[min(42rem,calc(100vw-2rem))] flex-col rounded-lg border-2 border-outline-variant bg-surface p-5 shadow-xl"
    >
      <div class="flex items-center">
        <div class="min-w-0 flex-1">
          <Dialog.Title class="truncate text-dialog-title">{title}</Dialog.Title>
          {#if description}
            <Dialog.Description class="mt-1 text-body-md wrap-anywhere whitespace-pre-line text-on-surface-variant">
              {description}
            </Dialog.Description>
          {/if}
        </div>
        {@render titleTrailing?.()}
      </div>
      {#if header}
        <div class="mt-1.5 shrink-0">{@render header()}</div>
      {/if}
      {#if children}
        <div
          class="scrollbar-thin -mx-5 min-h-0 shrink overflow-x-clip overflow-y-auto {header
            ? 'mt-1.5'
            : 'mt-4'} {padded ? 'px-5' : ''}"
        >
          {@render children()}
        </div>
      {/if}
      {#if buttons}
        <div class="mt-5 flex flex-wrap justify-end gap-2">{@render buttons()}</div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
