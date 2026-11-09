<script lang="ts">
  import { pageSandbox, pageSrc } from "$lib/services/pageSource";
  import { frameScrollbars, themedPage } from "./frameScrollbars.svelte";
  import { framePage } from "./framePage.svelte";

  interface Props {
    url: string;
    name: string;
    title: string;
    zoomable?: boolean;
    onerror?: () => void;
    class?: string;
  }

  const { url, name, title, zoomable = false, onerror, class: className = "" }: Props = $props();
</script>

<iframe
  use:pageSrc={{ url, name, transform: themedPage, onerror }}
  use:frameScrollbars
  use:framePage={zoomable}
  {title}
  sandbox={pageSandbox}
  referrerpolicy="no-referrer"
  class={className}
></iframe>
