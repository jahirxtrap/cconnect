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
    buttons?: Snippet;
    children?: Snippet;
  }

  const { title, onDismiss, description, padded = true, titleTrailing, buttons, children }: Props = $props();

  $effect(() => pushDismiss(() => onDismiss()));
</script>

<Dialog.Root open onOpenChange={(open) => !open && onDismiss()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-60 bg-black/60" />
    <Dialog.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      class="menu-surface fixed inset-0 z-60 m-auto flex h-max max-h-[min(40rem,85%)] min-w-[min(24rem,calc(100vw-2rem))] max-w-[min(42rem,calc(100vw-2rem))] flex-col rounded-lg border-2 border-outline-variant bg-surface p-5 shadow-xl {children
        ? 'w-[min(42rem,calc(100vw-2rem))]'
        : 'w-max'}"
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
      {#if children}
        <div class="scrollbar-thin mt-4 min-h-0 shrink overflow-x-clip overflow-y-auto {padded ? '' : '-mx-5'}">
          {@render children()}
        </div>
      {/if}
      {#if buttons}
        <div class="mt-5 flex justify-end gap-2">{@render buttons()}</div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
