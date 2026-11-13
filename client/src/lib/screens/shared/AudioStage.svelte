<script lang="ts">
  import { joined } from "$lib/data/format";
  import { fileInfoAvailable, loadFileInfo, type FileInfo } from "$lib/services/fileInfo";
  import AudioCover from "$lib/ui/AudioCover.svelte";
  import MediaPlayer from "$lib/ui/MediaPlayer.svelte";

  interface Props {
    url: string;
    base: string;
    filename: string;
    active?: boolean;
    autoplay?: boolean;
    onerror?: () => void;
    onended?: () => void;
  }

  const { url, base, filename, active = true, autoplay = false, onerror, onended }: Props = $props();

  let info = $state<FileInfo | null | undefined>(undefined);

  const available = $derived(fileInfoAvailable(base));
  const tags = $derived(info?.media?.tags ?? {});
  const byline = $derived(joined(tags.artist ?? tags.album_artist, tags.album));

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

<div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6">
  <AudioCover url={base} class="h-72 max-h-full min-h-0 max-w-full shrink rounded-panel" />
  <div class="flex w-full max-w-lg min-w-0 flex-col items-center text-center {info === undefined ? 'invisible' : ''}">
    <p class="max-w-full truncate text-title-md">{tags.title ?? filename}</p>
    <p class="min-h-lh max-w-full truncate text-body-sm text-on-surface-variant">{byline}</p>
  </div>
  <MediaPlayer {url} kind="audio" stage {active} {autoplay} {onerror} {onended} class="w-full max-w-lg shrink-0" />
</div>
