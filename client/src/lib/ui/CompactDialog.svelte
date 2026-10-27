<script module lang="ts">
  import { ROW_VIEWPORT_CLASS } from "./scrollbar";

  export const DIALOG_PAGE_CLASS = `${ROW_VIEWPORT_CLASS} scrollbar-thin overflow-y-auto [--viewport-inset:calc(var(--spacing)*5)]`;

  export const DIALOG_LIST_CLASS = `${ROW_VIEWPORT_CLASS} scrollbar-thin flex max-h-[420px] flex-col overflow-y-auto [--viewport-inset:0px]`;
</script>

<script lang="ts">
  import { Dialog } from "bits-ui";
  import { untrack, type Snippet } from "svelte";
  import { pushDismiss } from "$lib/app/dismissStack";
  import { navigation } from "$lib/app/navigation.svelte";
  import { provideDialogSettled } from "./dialogSettled";
  import { DIALOG_OVERLAY_CLASS, DIALOG_SURFACE_CLASS } from "./menuSurface";
  import { viewportScrollbar } from "./scrollbar";

  interface Props {
    title: string;
    onDismiss: () => void;
    subtitle?: string | null;
    description?: string | null;
    titleTrailing?: Snippet;
    header?: Snippet;
    buttons?: Snippet;
    paged?: boolean;
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
    paged = false,
    children,
  }: Props = $props();

  const instant = untrack(() => navigation.returning);

  let settled = $state(instant);

  provideDialogSettled(() => settled);

  $effect(() => pushDismiss(() => onDismiss()));
</script>

<Dialog.Root open onOpenChange={(open) => !open && onDismiss()}>
  <Dialog.Portal>
    <Dialog.Overlay class={DIALOG_OVERLAY_CLASS} />
    <Dialog.Content
      data-instant={instant || undefined}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onanimationend={(event) => {
        if (event.target === event.currentTarget) settled = true;
      }}
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
          use:viewportScrollbar
          class="-mx-5 min-h-0 shrink {paged ? 'flex flex-col' : `overflow-x-clip ${DIALOG_PAGE_CLASS}`} {header
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
