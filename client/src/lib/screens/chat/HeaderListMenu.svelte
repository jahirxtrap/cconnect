<script lang="ts">
  import type { Snippet } from "svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";

  interface Props {
    label: string;
    count: string;
    trigger: Snippet;
    children: Snippet;
  }

  const { label, count, trigger, children }: Props = $props();

  let open = $state(false);
</script>

<PopupMenu
  {open}
  onOpenChange={(value) => (open = value)}
  {label}
  align="center"
  {trigger}
  triggerClass="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-hover"
>
  {#snippet header()}
    <p class="flex shrink-0 items-center gap-2 px-2.5 pt-1.5 pb-1 text-label-md text-on-surface-variant">
      <span class="min-w-0 flex-1 truncate">{label}</span>
      <span class="text-caption text-faint">{count}</span>
    </p>
  {/snippet}
  {@render children()}
</PopupMenu>
