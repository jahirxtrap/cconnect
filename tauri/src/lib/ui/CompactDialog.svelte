<script lang="ts">
  import { Dialog } from "bits-ui";
  import type { Snippet } from "svelte";

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
</script>

<Dialog.Root open onOpenChange={(open) => !open && onDismiss()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60" />
    <Dialog.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      class="menu-surface fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-max min-w-[min(24rem,calc(100vw-2rem))] max-w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-outline-variant bg-surface p-5 shadow-xl"
    >
      <div class="flex items-start gap-2">
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
        <div class="scrollbar-thin mt-4 min-h-0 flex-1 overflow-y-auto {padded ? '' : '-mx-5'}">
          {@render children()}
        </div>
      {/if}
      {#if buttons}
        <div class="mt-5 flex justify-end gap-2">{@render buttons()}</div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
