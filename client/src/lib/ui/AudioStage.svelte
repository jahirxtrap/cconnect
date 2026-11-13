<script lang="ts">
  import { formatSize, joined } from "$lib/data/format";
  import { extensionOf } from "$lib/data/previewKind";
  import { fileInfoAvailable, loadFileInfo, type FileInfo } from "$lib/services/fileInfo";
  import AudioCover from "./AudioCover.svelte";
  import MediaPlayer from "./MediaPlayer.svelte";

  interface Props {
    url: string;
    base: string;
    filename: string;
    title?: string;
    mini?: boolean;
    active?: boolean;
    autoplay?: boolean;
    onerror?: () => void;
    onended?: () => void;
  }

  const { url, base, filename, title, mini = false, active = true, autoplay = false, onerror, onended }: Props =
    $props();

  let info = $state<FileInfo | null | undefined>(undefined);
  let player = $state<MediaPlayer | null>(null);

  export const handOff = () => player?.handOff();

  const available = $derived(fileInfoAvailable(base));
  const tags = $derived(info?.media?.tags ?? {});
  const byline = $derived(
    joined(tags.artist ?? tags.album_artist, tags.album) ||
      joined(extensionOf(filename).toUpperCase(), info?.size != null && formatSize(info.size)),
  );

  $effect(() => {
    const target = base;
    const offered = available;
    info = undefined;
    if (offered === undefined) return;
    if (!offered) {
      info = null;
      return;
    }
    let current = true;
    void loadFileInfo(target).then((found) => {
      if (current) info = found;
    });
    return () => {
      current = false;
    };
  });
</script>

<div class="flex min-h-0 flex-col items-center justify-center {mini ? 'size-full gap-3 p-3' : 'flex-1 gap-6 p-6'}">
  <div class="flex aspect-square min-h-0 w-full max-w-lg shrink items-center justify-center [container-type:size]">
    <AudioCover url={base} cover={info === undefined ? null : (info?.media?.cover ?? true)} class="w-[min(100cqw,100cqh)] rounded-panel" />
  </div>
  <div class="flex w-full max-w-lg min-w-0 shrink-0 flex-col items-center gap-3">
    <div class="flex w-full min-w-0 flex-col items-center text-center {info === undefined ? 'invisible' : ''}">
      <p class="max-w-full truncate text-title-md">{tags.title ?? title ?? filename}</p>
      <p class="min-h-lh max-w-full truncate text-body-sm text-on-surface-variant">{byline}</p>
    </div>
    <MediaPlayer
      bind:this={player}
      {url}
      kind="audio"
      stage
      {active}
      {autoplay}
      {onerror}
      {onended}
      class="w-full"
    />
  </div>
</div>
