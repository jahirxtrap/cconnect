<script lang="ts">
  type Tone = "accent" | "red" | "blue" | "orange";

  interface Props {
    value?: number | null;
    tone?: Tone;
    color?: string | null;
    class?: string;
  }

  const { value = null, tone = "accent", color = null, class: className = "" }: Props = $props();

  const TRACK: Record<Tone, string> = {
    accent: "bg-outline-variant",
    red: "bg-outline-variant",
    blue: "bg-blue/30",
    orange: "bg-orange/30",
  };

  const BAR: Record<Tone, string> = {
    accent: "bg-accent",
    red: "bg-red",
    blue: "bg-blue",
    orange: "bg-orange",
  };

  const PERCENT = 100;
  const width = $derived(Math.min(1, Math.max(0, value ?? 0)) * PERCENT);
</script>

<div class="h-1 w-full overflow-hidden rounded-full {TRACK[tone]} {className}">
  {#if value === null}
    <span class="block h-full w-2/5 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full {BAR[tone]}"></span>
  {:else}
    <span
      class="block h-full rounded-full transition-[width] {color ? '' : BAR[tone]}"
      style="width: {width}%{color ? `; background: ${color}` : ''}"
    ></span>
  {/if}
</div>
