<script lang="ts" module>
  export interface ReplyHandlers {
    speaking: boolean;
    selection: boolean;
    onArm: () => void;
    onCopy: () => void;
    onShare: (() => void) | null;
    onSpeak: (() => void) | null;
    onFork: (() => void) | null;
  }
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import GitFork from "@lucide/svelte/icons/git-fork";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import { formatClock } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { CopyFeedback } from "$lib/ui/copyFeedback.svelte";
  import StopIcon from "$lib/ui/StopIcon.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props extends ReplyHandlers {
    timestamp: number | null;
  }

  const { timestamp, speaking, selection, onArm, onCopy, onShare, onSpeak, onFork }: Props = $props();

  const BUTTON_CLASS = "size-7";
  const STOP_SIZE_CLASS = "[&_svg]:size-3.75";

  const feedback = new CopyFeedback();

  const copy = () => {
    onCopy();
    feedback.mark();
  };

  const speakLabel = $derived(
    speaking ? t("SPEECH_STOP") : selection ? t("SPEECH_LISTEN_SELECTION") : t("SPEECH_LISTEN"),
  );
</script>

<div class="flex w-full items-center px-(--page-inset) pt-1">
  {#if timestamp !== null}
    <span class="text-caption text-faint select-none">{formatClock(timestamp)}</span>
  {/if}
  <span class="flex-1"></span>
  {#if onFork}
    <TooltipIconButton label={t("FORK_FROM_HERE")} onclick={onFork} class={BUTTON_CLASS}>
      <GitFork />
    </TooltipIconButton>
  {/if}
  {#if onSpeak}
    <TooltipIconButton
      label={speakLabel}
      active={speaking || selection}
      onclick={onSpeak}
      onpointerdown={onArm}
      class={speaking ? `${BUTTON_CLASS} ${STOP_SIZE_CLASS}` : BUTTON_CLASS}
    >
      {#if speaking}
        <StopIcon />
      {:else}
        <Volume2 />
      {/if}
    </TooltipIconButton>
  {/if}
  {#if onShare}
    <TooltipIconButton label={t("SHARE")} onclick={onShare} class={BUTTON_CLASS}>
      <Share2 />
    </TooltipIconButton>
  {/if}
  <TooltipIconButton label={t("COPY")} active={feedback.copied} onclick={copy} class={BUTTON_CLASS}>
    {#if feedback.copied}
      <Check />
    {:else}
      <Copy />
    {/if}
  </TooltipIconButton>
</div>
