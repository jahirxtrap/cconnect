<script lang="ts">
  import { panes } from "./panes.svelte";
  import { tabs } from "./tabs.svelte";
  import TabSwitcher from "./TabSwitcher.svelte";
</script>

<TabSwitcher
  center={tabs.center}
  right={tabs.right}
  activeId={panes.focusedTab?.id ?? null}
  onSelect={(id) => panes.reveal(id)}
  onClose={(id) => panes.close(id)}
  onMove={(id, to) => tabs.move(id, to)}
  onNew={() => panes.newTab()}
/>
