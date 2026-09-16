<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { PANE_BODY_CLASS } from "./paneChrome";
  import { providePaneSurface } from "./paneSurface";
  import type { PaneRole } from "./tabs.svelte";

  interface Props {
    children: Snippet;
    role?: PaneRole;
  }

  const { children, role = "right" }: Props = $props();

  providePaneSurface(untrack(() => role));
</script>

<div class="{PANE_BODY_CLASS} {role === 'right' ? 'border-l border-outline-variant' : ''}">
  {@render children()}
</div>
