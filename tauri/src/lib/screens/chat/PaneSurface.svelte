<script lang="ts">
  import type { Snippet } from "svelte";
  import { PANE_BODY_CLASS } from "./paneChrome";
  import { providePaneSurface } from "./paneSurface";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();

  providePaneSurface();
</script>

<div class={PANE_BODY_CLASS}>
  {@render children()}
</div>
