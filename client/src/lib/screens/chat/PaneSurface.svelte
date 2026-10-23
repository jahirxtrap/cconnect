<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { PANE_BODY_CLASS } from "./paneChrome";
  import { providePaneSurface } from "./paneSurface";
  import type { PaneRole } from "./tabs.svelte";

  interface Props {
    children: Snippet;
    role?: PaneRole;
    plain?: boolean;
  }

  const { children, role = "right", plain = false }: Props = $props();

  providePaneSurface(untrack(() => role));
</script>

<div
  class="{PANE_BODY_CLASS} {role === 'right' && !layout.mobile ? 'border-l border-outline-variant' : ''} {role === 'right' &&
  !plain
    ? '[--page-inset:8px]'
    : ''}"
>
  {@render children()}
</div>
