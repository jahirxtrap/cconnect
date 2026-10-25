<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Clock3 from "@lucide/svelte/icons/clock-3";
  import { retryReason, type ApiRetry } from "$lib/data/apiRetry";
  import { formatDuration, joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import NoticeCard from "./NoticeCard.svelte";
  import type { Tint } from "./tint";

  interface Props {
    kind: "retrying" | "compacting";
    retry?: ApiRetry | null;
  }

  const { kind, retry = null }: Props = $props();

  const MILLIS_PER_SECOND = 1000;

  let now = $state(Date.now());

  $effect(() => {
    if (!retry) return;
    const until = retry.until;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const step = () => {
      now = Date.now();
      const left = until - now;
      if (left > 0) timer = setTimeout(step, ((left - 1) % MILLIS_PER_SECOND) + 1);
    };
    step();
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  });

  const compacting = $derived(kind === "compacting");
  const tone = $derived<Tint>(compacting ? "blue" : "orange");
  const label = $derived(compacting ? t("COMPACTING") : t("STATUS_RETRYING"));
  const left = $derived(retry ? Math.max(0, retry.until - now) : 0);
  const reason = $derived(retry ? retryReason(retry) : null);
  const detail = $derived(
    retry
      ? joined(
          t("STATUS_RETRY_ATTEMPT", retry.attempt, retry.maxRetries),
          left > 0 && t("STATUS_RETRY_NEXT", formatDuration(Math.ceil(left / MILLIS_PER_SECOND) * MILLIS_PER_SECOND)),
          reason && t(reason),
        )
      : "",
  );
  const countdown = $derived(retry && left > 0 && retry.delayMs > 0 ? left / retry.delayMs : null);
</script>

<NoticeCard {tone} icon={compacting ? Archive : Clock3} title={label} {detail}>
  <LinearProgress value={countdown} {tone} class="mt-2" />
</NoticeCard>
