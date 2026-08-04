<script lang="ts">
  import { Dialog } from "bits-ui";
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    onDismiss: () => void;
    padded?: boolean;
    titleTrailing?: Snippet;
    buttons?: Snippet;
    children: Snippet;
  }

  const { title, onDismiss, padded = true, titleTrailing, buttons, children }: Props = $props();
</script>

<Dialog.Root open onOpenChange={(open) => !open && onDismiss()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 flex max-h-160 w-max min-w-70 max-w-[min(35rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-surface-variant py-3.5 shadow-xl"
    >
      <div class="flex items-center {titleTrailing ? 'pr-2 pl-5' : 'px-5'}">
        <Dialog.Title class="min-w-0 flex-1 truncate text-dialog-title">{title}</Dialog.Title>
        {@render titleTrailing?.()}
      </div>
      <div class="mt-3 min-h-0 flex-1 overflow-y-auto {padded ? 'px-5' : ''}">
        {@render children()}
      </div>
      {#if buttons}
        <div class="mt-3 flex justify-end px-3">{@render buttons()}</div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
