<script lang="ts">
  import { SHELL_MARK, shellOutput, type ShellRun } from "$lib/data/shellPrompt";
  import { t } from "$lib/i18n/index.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import { HEAD_STATUS } from "./headTones";

  interface Props {
    run: ShellRun;
  }

  const { run }: Props = $props();

  const GLYPH = "size-(--chat-glyph) shrink-0";
  const failed = HEAD_STATUS.failed;

  const output = $derived(shellOutput(run));
</script>

<div class="flex items-start gap-2">
  <p class="min-w-0 flex-1 font-mono text-body-md leading-(--chat-line-body) wrap-anywhere whitespace-pre-wrap"><span class="font-semibold text-accent">{SHELL_MARK}</span> {run.command}</p>
  {#if run.code !== 0}
    <span class="flex h-(--chat-line-body) shrink-0 items-center gap-2">
      {#if run.code === null}
        <LoadingIndicator class="{GLYPH} text-accent" />
      {:else}
        <span class="text-body-sm text-faint">{t("EXIT_CODE", String(run.code))}</span>
        <failed.icon class="{GLYPH} {failed.color}" role="img" aria-label={t(failed.label)} />
      {/if}
    </span>
  {/if}
</div>
{#if output}
  <CodeBlock code={output} lang={t("RESULT")} capped />
{/if}
