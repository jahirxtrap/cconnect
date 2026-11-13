<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import FastForward from "@lucide/svelte/icons/fast-forward";
  import Gauge from "@lucide/svelte/icons/gauge";
  import Maximize from "@lucide/svelte/icons/maximize";
  import Minimize from "@lucide/svelte/icons/minimize";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import Rewind from "@lucide/svelte/icons/rewind";
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import { formatDecimal, formatPercent } from "$lib/data/format";
  import { settings } from "$lib/data/settings.svelte";
  import { formatMediaTime } from "$lib/data/time";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import { fullscreen } from "$lib/platform/fullscreen.svelte";
  import { mediaDuration } from "$lib/services/mediaDuration";
  import { imageSrc, servedSrc } from "$lib/services/mediaSource";
  import CenteredProgress from "./CenteredProgress.svelte";
  import { MEDIA_FADE_CLASS, MEDIA_SCRIM_CLASS, ON_MEDIA_CLASS } from "./mediaFrame";
  import { leaveHandoff, takeHandoff } from "./mediaHandoff";
  import MenuItem from "./MenuItem.svelte";
  import MenuSlider from "./MenuSlider.svelte";
  import PopupMenu from "./PopupMenu.svelte";
  import { ROUND_ACCENT_CLASS } from "./roundButton";
  import Slider from "./Slider.svelte";
  import SpeakerIcon from "./SpeakerIcon.svelte";
  import ZoomPane from "./ZoomPane.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Props {
    url: string;
    kind: "video" | "audio";
    poster?: string | null;
    duration?: number | null;
    preload?: "none" | "metadata" | "auto";
    stage?: boolean;
    zoomable?: boolean;
    active?: boolean;
    autoplay?: boolean;
    paused?: boolean;
    onerror?: () => void;
    onPosterError?: () => void;
    onended?: () => void;
    artwork?: Snippet;
    class?: string;
  }

  let {
    url,
    kind,
    poster = null,
    duration: given = null,
    preload = "metadata",
    stage = false,
    zoomable = false,
    active = true,
    autoplay = false,
    paused = $bindable(true),
    onerror,
    onPosterError,
    onended,
    artwork,
    class: className = "",
  }: Props = $props();

  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const SKIP_SECONDS = 10;
  const NUDGE_SECONDS = 5;
  const SEEK_STEP = 0.1;
  const VOLUME_STEP = 0.01;
  const CONTROLS_IDLE_MS = 2500;
  const TIME_CLASS = "shrink-0 text-body-sm tabular-nums";
  const VOLUME_OPTIONS = Array.from({ length: Math.round(1 / VOLUME_STEP) + 1 }, (_, step) => ({
    value: String(step),
    label: formatPercent(step * VOLUME_STEP),
  }));

  let media = $state<HTMLMediaElement | null>(null);
  let frame = $state<HTMLDivElement | null>(null);
  let current = $state(0);
  let started = $state(false);
  let length = $state(Number.NaN);
  let ranges = $state<{ start: number; end: number }[]>([]);
  let rate = $state(1);
  let waiting = $state(false);
  let known = $state<number | null>(null);
  let awake = $state(true);
  let speedOpen = $state(false);
  let volumeOpen = $state(false);
  let zoom = $state<ZoomPane | null>(null);
  let wasExpanded = false;
  let woke = $state(0);

  const video = $derived(kind === "video");
  const framed = $derived(video || artwork !== undefined);
  const volume = $derived(settings.mediaVolume);
  const muted = $derived(settings.mediaMuted);
  const duration = $derived(Number.isFinite(length) && length > 0 ? length : (known ?? given ?? 0));
  const loaded = $derived(ranges.find((range) => range.start <= current && current <= range.end)?.end ?? null);
  const expanded = $derived(fullscreen.holds(frame));
  const shown = $derived(!video || paused || awake || speedOpen || volumeOpen);
  const canExpand = $derived(video && media !== null && fullscreen.supported(media as HTMLVideoElement));

  const rateText = (value: number) => `${formatDecimal(value, 2, 0)}×`;

  $effect(() => {
    const now = expanded;
    if (wasExpanded && !now) untrack(() => zoom?.reset());
    wasExpanded = now;
  });

  $effect(() => {
    if (!video || preload !== "none") return;
    let active = true;
    void mediaDuration(url).then((seconds) => {
      if (active) known = seconds;
    });
    return () => {
      active = false;
    };
  });

  $effect(() => {
    if (!awake || paused) return;
    void woke;
    const timer = setTimeout(() => (awake = false), CONTROLS_IDLE_MS);
    return () => clearTimeout(timer);
  });

  const wake = () => {
    awake = true;
    woke += 1;
  };

  const sleep = () => (awake = false);

  const resume = untrack(() => takeHandoff(url));
  let ready = $state(false);

  const play = () => void media?.play().catch(() => {});

  const begin = () => {
    if (ready) return;
    if (resume) current = resume.at;
    if (resume?.playing) play();
    ready = true;
  };

  $effect(() => {
    if (!active) untrack(() => media?.pause());
    else if (ready && autoplay) untrack(play);
  });

  export function toggle() {
    if (!media) return;
    if (media.paused) play();
    else media.pause();
  }

  export function handOff() {
    leaveHandoff(url, { at: current, playing: !paused });
    media?.pause();
  }

  const skip = (seconds: number) => {
    current = Math.min(Math.max(current + seconds, 0), duration || current + seconds);
  };

  const setVolume = (value: number) => {
    settings.mediaVolume = value;
    settings.mediaMuted = value === 0;
  };

  const toggleMute = () => (settings.mediaMuted = !settings.mediaMuted);

  const expand = () => {
    if (frame) void fullscreen.toggle(frame, media as HTMLVideoElement).catch(() => {});
  };

  const KEYS: Record<string, () => void> = {
    " ": toggle,
    k: toggle,
    ArrowLeft: () => skip(-NUDGE_SECONDS),
    ArrowRight: () => skip(NUDGE_SECONDS),
    m: toggleMute,
    f: () => canExpand && expand(),
  };

  const press = (event: KeyboardEvent) => {
    const action = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement).closest("button, input")) return;
    event.preventDefault();
    event.stopPropagation();
    action();
    wake();
  };

  const tapSurface = (event: MouseEvent) => {
    if ((event as PointerEvent).pointerType !== "touch") {
      toggle();
      return;
    }
    if (shown && !paused) sleep();
    else wake();
  };

  const settle = () => (waiting = false);
</script>

{#snippet speed(onMedia: boolean)}
  <PopupMenu open={speedOpen} onOpenChange={(value) => (speedOpen = value)} label={t("MEDIA_SPEED")} side="top">
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("MEDIA_SPEED")} {onMedia} active={rate !== 1} {...props}>
        <Gauge />
      </TooltipIconButton>
    {/snippet}
    {#each RATES as option (option)}
      <MenuItem text={rateText(option)} selected={option === rate} onclick={() => (rate = option)} />
    {/each}
  </PopupMenu>
{/snippet}

{#snippet volumeMenu(onMedia: boolean)}
  <PopupMenu open={volumeOpen} onOpenChange={(value) => (volumeOpen = value)} label={t("MEDIA_VOLUME")} side="top">
    {#snippet triggerChild(props)}
      <TooltipIconButton label={t("MEDIA_VOLUME")} {onMedia} {...props}>
        <SpeakerIcon {muted} {volume} />
      </TooltipIconButton>
    {/snippet}
    <MenuSlider
      text={t("MEDIA_VOLUME")}
      icon={Volume2}
      options={VOLUME_OPTIONS}
      selected={String(muted ? 0 : Math.round(volume / VOLUME_STEP))}
      onPick={(step) => setVolume(Number(step) * VOLUME_STEP)}
    />
  </PopupMenu>
{/snippet}

{#snippet speaker(onMedia: boolean)}
  {#if isTouch}
    {@render volumeMenu(onMedia)}
  {:else}
    <span class="contents @sm:hidden">{@render volumeMenu(onMedia)}</span>
    <span class="hidden @sm:contents">
      <TooltipIconButton label={muted ? t("MEDIA_UNMUTE") : t("MEDIA_MUTE")} {onMedia} onclick={toggleMute}>
        <SpeakerIcon {muted} {volume} />
      </TooltipIconButton>
      <span class="flex w-16">
        <Slider value={muted ? 0 : volume} max={1} step={VOLUME_STEP} showValue={false} onChange={setVolume} class="w-full" />
      </span>
    </span>
  {/if}
{/snippet}

{#snippet seekBar()}
  <Slider
    value={current}
    max={duration || 1}
    step={SEEK_STEP}
    pending={duration === 0}
    showValue={false}
    loaded={duration > 0 ? loaded : null}
    onChange={(value) => (current = value)}
    class="min-w-0 flex-1"
  />
{/snippet}

{#if !video}
  <audio
    bind:this={media}
    use:servedSrc={{ url, onerror }}
    {preload}
    bind:paused
    bind:currentTime={current}
    bind:duration={length}
    bind:buffered={ranges}
    bind:volume={() => settings.mediaVolume, (value) => (settings.mediaVolume = value)}
    bind:muted={() => settings.mediaMuted, (value) => (settings.mediaMuted = value)}
    bind:playbackRate={rate}
    onloadedmetadata={begin}
    onwaiting={() => (waiting = true)}
    onplaying={settle}
    oncanplay={settle}
    onpause={settle}
    {onended}
  ></audio>
{/if}

{#if framed}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={frame}
    tabindex="0"
    role="region"
    aria-label={t("MEDIA_PLAYER")}
    onkeydown={press}
    onpointermove={(event) => event.pointerType !== "touch" && wake()}
    onpointerleave={(event) => event.pointerType !== "touch" && !paused && sleep()}
    class="@container relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden outline-none {expanded
      ? 'bg-black'
      : ''} {className}"
  >
    {#if video}
      <ZoomPane bind:this={zoom} active={zoomable || expanded} doubleTap={false} class="size-full">
        <!-- svelte-ignore a11y_media_has_caption -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <video
          bind:this={media}
          use:servedSrc={{ url, onerror }}
          {preload}
          playsinline
          bind:paused
          bind:currentTime={current}
          bind:duration={length}
          bind:buffered={ranges}
          bind:volume={() => settings.mediaVolume, (value) => (settings.mediaVolume = value)}
          bind:muted={() => settings.mediaMuted, (value) => (settings.mediaMuted = value)}
          bind:playbackRate={rate}
          onloadedmetadata={begin}
          onplay={wake}
          onwaiting={() => (waiting = true)}
          onplaying={() => {
            settle();
            started = true;
          }}
          onseeked={() => (started = true)}
          oncanplay={settle}
          onpause={settle}
          {onended}
          onclick={tapSurface}
          ondblclick={() => canExpand && expand()}
          class="size-full object-contain"
        ></video>

        {#if poster && !started}
          <img
            use:imageSrc={{ url: poster, onerror: onPosterError }}
            alt=""
            draggable="false"
            class="pointer-events-none absolute inset-0 size-full object-contain"
          />
        {/if}
      </ZoomPane>
    {:else}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div onclick={toggle} class="flex size-full cursor-pointer items-center justify-center">
        {@render artwork?.()}
      </div>
    {/if}

    {#if waiting && !paused}
      <CenteredProgress class="pointer-events-none absolute inset-0" />
    {:else if paused}
      <button
        type="button"
        aria-label={t("MEDIA_PLAY")}
        onclick={toggle}
        class="absolute inline-flex size-14 cursor-pointer items-center justify-center rounded-full {MEDIA_SCRIM_CLASS} {ON_MEDIA_CLASS}"
      >
        <Play size={28} fill="currentColor" />
      </button>
    {/if}

    <div
      class="absolute inset-x-0 bottom-0 flex flex-col px-2 pt-8 pb-1 transition-opacity {MEDIA_FADE_CLASS} {shown
        ? ''
        : 'pointer-events-none opacity-0'}"
    >
      <div class="px-1">{@render seekBar()}</div>
      <div class="flex min-w-0 items-center gap-0.5">
        <TooltipIconButton label={paused ? t("MEDIA_PLAY") : t("MEDIA_PAUSE")} onMedia onclick={toggle}>
          {#if paused}
            <Play fill="currentColor" />
          {:else}
            <Pause fill="currentColor" />
          {/if}
        </TooltipIconButton>
        {@render speaker(true)}
        <span class="ml-1 min-w-0 truncate {TIME_CLASS} {ON_MEDIA_CLASS}">
          {formatMediaTime(current)} / {formatMediaTime(duration)}
        </span>
        <span class="flex-1"></span>
        <span class="hidden @2xs:contents">{@render speed(true)}</span>
        {#if canExpand}
          <TooltipIconButton
            label={expanded ? t("MEDIA_EXIT_FULLSCREEN") : t("MEDIA_FULLSCREEN")}
            onMedia
            onclick={expand}
          >
            {#if expanded}
              <Minimize />
            {:else}
              <Maximize />
            {/if}
          </TooltipIconButton>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    tabindex="0"
    role="region"
    aria-label={t("MEDIA_PLAYER")}
    onkeydown={press}
    class="@container flex min-w-0 flex-col outline-none {className}"
  >
    {#if stage}
      <div class="flex min-w-0 items-center gap-2">
        <span class="{TIME_CLASS} text-on-surface-variant">{formatMediaTime(current)}</span>
        {@render seekBar()}
        <span class="{TIME_CLASS} text-on-surface-variant">{formatMediaTime(duration)}</span>
      </div>
      <div class="mt-3 grid grid-cols-[1fr_auto_1fr] items-center">
        <div class="flex items-center gap-0.5">
          {@render speaker(false)}
        </div>
        <div class="flex items-center gap-3">
          <TooltipIconButton label={plural("MEDIA_BACK", SKIP_SECONDS)} onclick={() => skip(-SKIP_SECONDS)} class="size-10">
            <Rewind fill="currentColor" />
          </TooltipIconButton>
          <button
            type="button"
            aria-label={paused ? t("MEDIA_PLAY") : t("MEDIA_PAUSE")}
            onclick={toggle}
            class="{ROUND_ACCENT_CLASS} size-14"
          >
            {#if paused}
              <Play size={26} fill="currentColor" />
            {:else}
              <Pause size={26} fill="currentColor" />
            {/if}
          </button>
          <TooltipIconButton label={plural("MEDIA_FORWARD", SKIP_SECONDS)} onclick={() => skip(SKIP_SECONDS)} class="size-10">
            <FastForward fill="currentColor" />
          </TooltipIconButton>
        </div>
        <div class="flex items-center justify-end gap-0.5">
          {@render speed(false)}
        </div>
      </div>
    {:else}
      <div class="flex min-w-0 items-center gap-2 rounded-full bg-surface-variant p-1">
        <button
          type="button"
          aria-label={paused ? t("MEDIA_PLAY") : t("MEDIA_PAUSE")}
          onclick={toggle}
          class={ROUND_ACCENT_CLASS}
        >
          {#if paused}
            <Play size={16} fill="currentColor" />
          {:else}
            <Pause size={16} fill="currentColor" />
          {/if}
        </button>
        <span class="{TIME_CLASS} text-on-surface-variant">
          {formatMediaTime(current)} / {formatMediaTime(duration)}
        </span>
        {@render seekBar()}
        <div class="flex shrink-0 items-center gap-0.5">
          {@render speaker(false)}
          <span class="hidden @2xs:contents">{@render speed(false)}</span>
        </div>
      </div>
    {/if}
  </div>
{/if}
