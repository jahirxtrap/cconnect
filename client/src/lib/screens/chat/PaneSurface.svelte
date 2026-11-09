<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { COMPACT_INSET_CLASS, PANE_BODY_CLASS } from "./paneChrome";
  import { compactPane, providePaneSurface } from "./paneSurface";
  import type { PaneRole } from "./tabs.svelte";

  interface Props {
    children: Snippet;
    role?: PaneRole;
    plain?: boolean;
  }

  const { children, role = "right", plain = false }: Props = $props();

  providePaneSurface(untrack(() => role));
</script>

<div class="{PANE_BODY_CLASS} {compactPane(role, plain) ? COMPACT_INSET_CLASS : ''}">
  {@render children()}
</div>
