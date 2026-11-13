<script lang="ts">
  import Volume1 from "@lucide/svelte/icons/volume-1";
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import VolumeX from "@lucide/svelte/icons/volume-x";

  interface Props {
    muted: boolean;
    volume: number;
    size?: number;
  }

  const { muted, volume, size = 24 }: Props = $props();

  const LOUD_FROM = 0.5;

  const Icon = $derived(muted || volume === 0 ? VolumeX : volume < LOUD_FROM ? Volume1 : Volume2);
</script>

<Icon {size} class="[&>path:first-child]:fill-current" />
