<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { DropdownMenu } from "bits-ui";
  import { uploads } from "$lib/data/uploads.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import ProgressRing from "$lib/ui/ProgressRing.svelte";

  const RING = 20;
  const STROKE = 2.5;

  let open = $state(false);

  const items = $derived(uploads.items);
  const finished = $derived(items.filter((item) => item.status !== "uploading").length);
  const allDone = $derived(items.length > 0 && finished === items.length);
  const progress = $derived(
    items.length
      ? items.reduce((total, item) => total + (item.status === "uploading" ? item.progress : 1), 0) / items.length
      : 0,
  );
</script>

{#if items.length}
  <DropdownMenu.Root
    open={open}
    onOpenChange={(value) => {
      open = value;
      if (!value && allDone) uploads.clearFinished();
    }}
  >
    <DropdownMenu.Trigger
      class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-on-surface/8"
      aria-label={t("UPLOADS")}
    >
      <span class="relative inline-flex items-center justify-center">
        <ProgressRing value={progress} size={RING} stroke={STROKE} class="text-accent transition-[stroke-dashoffset]" />
        {#if allDone}
          <Check size={12} class="absolute text-accent" />
        {/if}
      </span>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={4}
        class="menu-surface z-50 max-h-95 w-80 overflow-hidden rounded-md border border-outline-variant bg-surface-variant shadow-lg"
      >
        <p class="px-3.5 pt-2.5 pb-2 text-label-lg font-bold text-on-surface-variant">
          {t("UPLOADS")} ({finished}/{items.length})
        </p>
        <div class="scrollbar-thin max-h-80 overflow-y-auto border-t border-outline-variant py-1">
          {#each items as item (item.id)}
            <div class="flex items-center gap-2.5 px-3.5 py-1.5">
              <span
                class="min-w-0 flex-1 truncate text-body-md {item.status === 'done'
                  ? 'text-on-surface-variant'
                  : ''}"
              >
                {item.name}
              </span>
              {#if item.status === "uploading"}
                <ProgressRing value={item.progress} size={20} stroke={2.5} />
                <button
                  type="button"
                  onclick={() => uploads.cancel(item.id)}
                  aria-label={t("CANCEL")}
                  class="cursor-pointer text-on-surface-variant"
                >
                  <X size={18} />
                </button>
              {:else if item.status === "done"}
                <Check size={18} class="text-accent" />
              {:else}
                <X size={18} class="text-red" />
              {/if}
            </div>
          {/each}
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
{/if}
