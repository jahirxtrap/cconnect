<script lang="ts">
  import Maximize2 from "@lucide/svelte/icons/maximize-2";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import type { GalleryFile } from "$lib/data/chatModels";
  import { formatMediaTime } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import CardPanel from "./CardPanel.svelte";
  import ListRow from "./ListRow.svelte";
  import { MEDIA_FRAME_CLASS } from "./mediaFrame";
  import MediaPlayer from "./MediaPlayer.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Track {
    url: string;
    name: string;
    title?: string;
    duration?: number;
  }

  interface Props {
    tracks: Track[];
    onOpen: (url: string, filename: string, gallery?: GalleryFile[]) => void;
  }

  const { tracks, onOpen }: Props = $props();

  let index = $state(0);
  let autoplay = $state(false);
  let paused = $state(true);
  let player = $state<MediaPlayer | null>(null);

  const current = $derived(tracks[Math.min(index, tracks.length - 1)]);
  const listed = $derived(tracks.length > 1);

  const titleOf = (track: Track) => track.title || track.name;

  const select = (position: number) => {
    if (position === index) {
      player?.toggle();
      return;
    }
    index = position;
    autoplay = true;
  };

  const advance = () => {
    if (index >= tracks.length - 1) return;
    index += 1;
    autoplay = true;
  };

  const expand = () => {
    player?.handOff();
    onOpen(
      current.url,
      current.name,
      listed ? tracks.map((track) => ({ url: track.url, name: track.name })) : undefined,
    );
  };
</script>

<CardPanel dense class="w-full gap-1 {MEDIA_FRAME_CLASS}">
  <div class="flex min-w-0 items-center pl-3">
    {#if listed}
      <span class="min-w-0 flex-1 truncate text-label-md text-on-surface-variant">{t("MEDIA_PLAYLIST")}</span>
    {:else}
      <span class="min-w-0 flex-1 truncate text-body-md">{titleOf(current)}</span>
    {/if}
    <TooltipIconButton label={t("EXPAND")} onclick={expand}>
      <Maximize2 />
    </TooltipIconButton>
  </div>
  {#if listed}
    <div class="flex flex-col">
      {#each tracks as track, position (track.url)}
        {@const playing = position === index}
        <ListRow title={titleOf(track)} onclick={() => select(position)} class={playing ? "text-accent" : ""}>
          {#snippet leading()}
            <span class="flex size-5 shrink-0 items-center justify-center">
              {#if playing && !paused}
                <Pause size={16} fill="currentColor" />
              {:else if playing}
                <Play size={16} fill="currentColor" />
              {:else}
                <span class="text-body-sm text-on-surface-variant tabular-nums">{position + 1}</span>
              {/if}
            </span>
          {/snippet}
          {#snippet trailing()}
            {#if track.duration}
              <span class="pr-2 text-body-sm text-on-surface-variant tabular-nums">{formatMediaTime(track.duration)}</span>
            {/if}
          {/snippet}
        </ListRow>
      {/each}
    </div>
  {/if}
  {#key current.url}
    <MediaPlayer
      bind:this={player}
      bind:paused
      url={current.url}
      kind="audio"
      duration={current.duration}
      {autoplay}
      onended={advance}
    />
  {/key}
</CardPanel>
