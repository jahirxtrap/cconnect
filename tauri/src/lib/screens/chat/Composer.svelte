<script lang="ts">
  import Send from "@lucide/svelte/icons/send";
  import Square from "@lucide/svelte/icons/square";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    streaming: boolean;
    onSend: (text: string) => void;
    onInterrupt: () => void;
  }

  const { streaming, onSend, onInterrupt }: Props = $props();

  const MAX_ROWS = 10;

  let text = $state("");
  let field = $state<HTMLTextAreaElement | null>(null);

  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    text = "";
    resize();
  };

  const resize = () => {
    if (!field) return;
    field.style.height = "auto";
    const line = Number.parseFloat(getComputedStyle(field).lineHeight) || 20;
    field.style.height = `${Math.min(field.scrollHeight, line * MAX_ROWS)}px`;
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (layout.touch) return;
    event.preventDefault();
    submit();
  };
</script>

<div class="shrink-0 px-3 pb-3">
  <div class="flex items-end gap-1 rounded-md border border-outline-variant bg-surface px-3 py-1.5 focus-within:border-accent">
    <textarea
      bind:this={field}
      bind:value={text}
      {onkeydown}
      oninput={resize}
      rows="1"
      placeholder={t("TYPE_MESSAGE")}
      class="max-h-52 min-w-0 flex-1 resize-none bg-transparent py-2 text-body-md caret-accent outline-none placeholder:text-on-surface-variant"
    ></textarea>
    {#if streaming}
      <TooltipIconButton label={t("STOP")} onclick={onInterrupt}>
        <Square size={18} class="fill-current" />
      </TooltipIconButton>
    {:else}
      <TooltipIconButton label={t("SEND")} enabled={!!text.trim()} onclick={submit}>
        <Send size={18} />
      </TooltipIconButton>
    {/if}
  </div>
</div>
