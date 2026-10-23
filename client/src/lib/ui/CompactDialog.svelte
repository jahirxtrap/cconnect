<script lang="ts">
  import { Dialog } from "bits-ui";
  import type { Snippet } from "svelte";
  import { pushDismiss } from "$lib/app/dismissStack";
  import { DIALOG_OVERLAY_CLASS, DIALOG_SURFACE_CLASS } from "./menuSurface";

  interface Props {
    title: string;
    onDismiss: () => void;
    subtitle?: string | null;
    description?: string | null;
    titleTrailing?: Snippet;
    header?: Snippet;
    buttons?: Snippet;
    children?: Snippet;
  }

  const {
    title,
    onDismiss,
    subtitle,
    description,
    titleTrailing,
    header,
    buttons,
    children,
  }: Props = $props();

  $effect(() => pushDismiss(() => onDismiss()));
</script>

<Dialog.Root open onOpenChange={(open) => !open && onDismiss()}>
  <Dialog.Portal>
    <Dialog.Overlay class={DIALOG_OVERLAY_CLASS} />
    <Dialog.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      class="{DIALOG_SURFACE_CLASS} safe-inset fixed z-60 m-auto flex h-max max-h-[min(40rem,calc(var(--safe-height)_-_2rem))] w-[min(42rem,calc(100vw-2rem))] flex-col p-5"
    >
      <div class="flex items-center">
        <div class="min-w-0 flex-1">
          <Dialog.Title class="truncate text-dialog-title">{title}</Dialog.Title>
          {#if subtitle}
            <p class="truncate text-topbar-subtitle text-on-surface-variant">{subtitle}</p>
          {/if}
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
          class="scrollbar-thin -mx-5 min-h-0 shrink overflow-x-clip overflow-y-auto px-5 {header
            ? 'mt-1.5'
            : 'mt-4'}"
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
