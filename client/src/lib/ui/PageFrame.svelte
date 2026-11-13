<script lang="ts">
  import { untrack } from "svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { pageSandbox, pageSrc } from "$lib/services/pageSource";
  import ActionButton from "./ActionButton.svelte";
  import EmptyState from "./EmptyState.svelte";
  import ServerUnavailable from "./ServerUnavailable.svelte";
  import { fileIcon } from "./fileIcons";
  import { frameScrollbars, themedPage } from "./frameScrollbars.svelte";
  import { framePage } from "./framePage.svelte";

  const CHANNEL = "cconnect-frame";

  interface FrameNotice {
    shown?: boolean;
    missing?: string;
  }

  interface Props {
    url: string;
    name: string;
    title: string;
    zoomable?: boolean;
    class?: string;
  }

  const { url, name, title, zoomable = false, class: className = "" }: Props = $props();

  let frame = $state<HTMLIFrameElement | null>(null);
  let opening = $state(0);
  let missing = $state(false);
  let renewing = false;
  let wasOffline = false;

  const offline = $derived(backend.sharedProfileOf(url)?.id === backend.active?.id && serverStatus.unavailable);

  const reopen = () => {
    missing = false;
    opening++;
  };

  $effect(() => {
    if (offline) wasOffline = true;
    else if (wasOffline) {
      wasOffline = false;
      untrack(reopen);
    }
  });

  $effect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame || event.source !== frame.contentWindow) return;
      const notice = (event.data as Record<string, FrameNotice> | null)?.[CHANNEL];
      if (notice?.shown) renewing = false;
      if (notice?.missing === "page" && !renewing) {
        renewing = true;
        reopen();
      } else if (notice?.missing) missing = true;
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });
</script>

<div class="relative {className}">
  {#key opening}
    <iframe
      bind:this={frame}
      use:pageSrc={{ url, name, transform: themedPage, onerror: () => (missing = true) }}
      use:frameScrollbars
      use:framePage={zoomable}
      {title}
      sandbox={pageSandbox}
      referrerpolicy="no-referrer"
      class="size-full border-0 {offline || missing ? 'invisible' : ''}"
    ></iframe>
  {/key}
  {#if offline}
    <ServerUnavailable class="absolute inset-0" />
  {:else if missing}
    <EmptyState icon={fileIcon(name)} text={t("FILE_UNAVAILABLE")} class="absolute inset-0">
      {#snippet action()}
        <ActionButton text={t("RETRY")} onclick={reopen} />
      {/snippet}
    </EmptyState>
  {/if}
</div>
